const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const localRoot = path.join(root, '.local');
const configFile = path.join(localRoot, 'config.json');

function assertLocalDatabase(raw) {
  let url;
  try { url = new URL(raw); } catch { throw Error('Local database URL is missing or invalid.'); }
  if (url.protocol !== 'mysql:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)
      || url.pathname !== '/zeroone_dev' || url.search || url.hash) {
    throw Error('Refusing this database: local mode only allows loopback MySQL /zeroone_dev.');
  }
  return url;
}
function loadLocalConfig() {
  if (!fs.existsSync(configFile)) {
    const source = path.join(root, 'backend', '.env');
    if (!fs.existsSync(source)) throw Error('Configure backend/.env with local zeroone_dev first.');
    const original = dotenv.parse(fs.readFileSync(source));
    assertLocalDatabase(original.DATABASE_URL);
    fs.mkdirSync(localRoot, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify({
      databaseUrl: original.DATABASE_URL,
      jwtSecret: crypto.randomBytes(48).toString('hex'),
      revalidateSecret: crypto.randomBytes(48).toString('hex'),
    }, null, 2), { flag: 'wx', mode: 0o600 });
  }
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assertLocalDatabase(config.databaseUrl);
  if (!config.jwtSecret || !config.revalidateSecret) throw Error('Local secrets are missing.');
  return config;
}
function localEnvironment(config) {
  assertLocalDatabase(config.databaseUrl);
  const runtime = path.join(localRoot, 'backend');
  fs.mkdirSync(path.join(runtime, 'uploads'), { recursive: true });
  const runtimeEnvFile = path.join(runtime, '.env');
  // Never load the real backend .env or its mail/payment/hosting credentials.
  if (!fs.existsSync(runtimeEnvFile)) fs.writeFileSync(runtimeEnvFile, '# Managed isolated local runtime\n', {mode:0o600});
  return {
    ...process.env, NODE_ENV:'development', TZ:'Asia/Karachi',
    DATABASE_URL:config.databaseUrl, JWT_SECRET:config.jwtSecret,
    REVALIDATE_SECRET:config.revalidateSecret, DOTENV_CONFIG_PATH:runtimeEnvFile,
    ZEROONE_LOCAL_ONLY:'true', LOCAL_EMAIL_OUTBOX:path.join(localRoot,'mail'),
    HOST:'127.0.0.1', PORT:'3001',
    API_URL:'http://localhost:3001', NEXT_PUBLIC_API_URL:'http://localhost:3001',
    WEBSITE_URL:'http://localhost:3002', ADMIN_URL:'http://localhost:3000',
    CORS_ORIGINS:'http://localhost:3000,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3002',
    TRUST_PROXY:'', TRUST_FRONTEND_PROXY_HEADERS:'true',
    RESEND_API_KEY:'', ADMIN_ALERT_EMAIL:'', ENABLE_IP_GEOLOCATION:'false',
    PAYMENT_EASYPAISA_NO:'LOCAL TEST ONLY', PAYMENT_EASYPAISA_TITLE:'Local test',
    PAYMENT_JAZZCASH_NO:'LOCAL TEST ONLY', PAYMENT_JAZZCASH_TITLE:'Local test',
    PAYMENT_BANK_NAME:'LOCAL TEST ONLY', PAYMENT_BANK_ACCOUNT:'LOCAL TEST ONLY',
    PAYMENT_BANK_IBAN:'LOCAL TEST ONLY', PAYMENT_BANK_TITLE:'Local test',
  };
}
module.exports={root,localRoot,configFile,assertLocalDatabase,loadLocalConfig,localEnvironment};
