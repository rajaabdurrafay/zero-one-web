const fs = require('node:fs');
const path = require('node:path');

// Hostinger deploys the directory containing server.js. Flatten the monorepo
// app into the standalone root so its traced dependencies stay beside it.
const app = process.argv[2];
if (!['website', 'admin'].includes(app)) {
  throw new Error('Expected website or admin');
}
const appRoot = path.resolve(__dirname, '..', app);
const standalone = path.join(appRoot, '.next', 'standalone');
const nestedApp = path.join(standalone, app);
if (fs.existsSync(path.join(nestedApp, 'server.js'))) {
  fs.cpSync(nestedApp, standalone, { recursive: true });
}
if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('Standalone server.js was not generated');
}
fs.cpSync(path.join(appRoot, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });
if (fs.existsSync(path.join(appRoot, 'public'))) {
  fs.cpSync(path.join(appRoot, 'public'), path.join(standalone, 'public'), { recursive: true });
}
console.log(`Prepared ${app} standalone server with dependencies and assets`);
