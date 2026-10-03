// npm run can propagate an install-only allow-scripts CLI flag to nested npm.
// Audit is read-only and executes no package lifecycle scripts.
const { spawnSync } = require('node:child_process');
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.toLowerCase() === 'npm_config_allow_scripts') delete env[key];
const npm = process.env.npm_execpath || require.resolve('npm/bin/npm-cli.js');
const result = spawnSync(process.execPath, [npm, 'audit', '--omit=dev'], { env, stdio: 'inherit', windowsHide: true });
process.exit(result.status ?? 1);
