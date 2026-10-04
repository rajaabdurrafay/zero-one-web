import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

test('hosted require entry listens immediately without running database automation', async () => {
  const child = spawn(process.execPath, ['-e', "require('./dist/server.js')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', ZEROONE_LOCAL_ONLY: '', HOST: '127.0.0.1', PORT: '0',
      DATABASE_URL: 'mysql://unused:unused@127.0.0.1:1/zeroone_test_startup',
      JWT_SECRET: 'isolated-host-startup-test-secret-20261004', WEBSITE_URL: 'http://localhost',
      ENABLE_BOOKING_AUTOMATION: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Hosted entry did not listen')), 10000);
      child.stdout.on('data', chunk => {
        output += chunk.toString();
        const match = output.match(/Server listening on port (\d+)/);
        if (match && output.includes('Booking automation disabled')) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error('Hosted entry exited: '+code)); });
    });
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
    assert.match(output, /Booking automation disabled/);
  } finally {
    child.kill();
  }
});
