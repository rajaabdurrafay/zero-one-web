// Lighthouse runs only against a task-owned localhost fixture, never production.
const path = require('node:path');
const { spawn } = require('node:child_process');
const { startFixture } = require('./redesign-fixture.cjs');
if (!process.env.LIGHTHOUSE_CLI || !process.env.REDESIGN_QA_OUTPUT)
  throw Error('Set LIGHTHOUSE_CLI and REDESIGN_QA_OUTPUT to local tool/output paths.');
async function main() {
  const fixture = await startFixture();
  try {
    for (const mode of ['mobile', 'desktop']) {
      await new Promise((resolve, reject) => {
        const args = [
          process.env.LIGHTHOUSE_CLI,
          fixture.url,
          '--output=json',
          '--output=html',
          '--output-path=' + path.join(process.env.REDESIGN_QA_OUTPUT, 'lighthouse-' + mode),
          '--chrome-flags=--headless',
          '--only-categories=performance,accessibility,best-practices,seo',
          '--quiet',
          ...(mode === 'desktop' ? ['--preset=desktop'] : []),
        ];
        const child = spawn(process.execPath, args, {
          env: process.env,
          windowsHide: true,
          stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('exit', (code) =>
          code === 0 ? resolve() : reject(Error('Lighthouse ' + mode + ' exited ' + code)),
        );
      });
    }
  } finally {
    await fixture.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
