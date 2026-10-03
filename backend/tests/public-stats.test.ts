import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createPublicStatsRouter } from '../src/routes/publicStats';
import { publicCache } from '../src/middleware/publicCache';
import { formatCount } from '../../website/lib/formatCount';

test('public visits count completed records only, returns no personal data, caches and invalidates', async () => {
  let calls = 0;
  const app = express();
  app.use(publicCache);
  app.use(
    '/api/public-stats',
    createPublicStatsRouter(async (query) => {
      assert.deepEqual(query, { where: { status: 'COMPLETED' } });
      return 2500 + calls++;
    }),
  );
  app.post('/api/test-complete', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + (server.address() as any).port;
  try {
    const read = async () => (await fetch(base + '/api/public-stats')).json();
    assert.deepEqual(await read(), { totalPlayerVisits: 2500 });
    assert.deepEqual(await read(), { totalPlayerVisits: 2500 });
    await fetch(base + '/api/test-complete', { method: 'POST' });
    assert.deepEqual(await read(), { totalPlayerVisits: 2501 });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('failed statistics return unavailable, never a fabricated zero or database details', async () => {
  const app = express();
  app.use(
    '/api/public-stats',
    createPublicStatsRouter(async () => {
      throw new Error('private database details');
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(
      'http://127.0.0.1:' + (server.address() as any).port + '/api/public-stats',
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Visit statistics are temporarily unavailable.',
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('visit counts compact without inflating totals across K/M boundaries', () => {
  for (const [value, label] of [
    [0, '0'],
    [999, '999'],
    [1000, '1K'],
    [2500, '2.5K'],
    [20000000, '20M'],
    [999999, '999.9K'],
    [1000000, '1M'],
  ] as const) {
    assert.equal(formatCount(value), label);
  }
  assert.equal(formatCount(-1), '—');
  assert.equal(formatCount(NaN), '—');
});
