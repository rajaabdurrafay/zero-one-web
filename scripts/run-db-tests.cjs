// Never infer a database from .env. An explicit isolated local test URL is mandatory.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const raw=process.env.TEST_DATABASE_URL;
if(!raw)throw Error('Set TEST_DATABASE_URL to an isolated local zeroone_test_* database.');
const url=new URL(raw);
if(url.protocol!=='mysql:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || !/^\/zeroone_test_[a-z0-9_]+$/.test(url.pathname))throw Error('Refusing a non-local or non-test database.');
const env={...process.env,DATABASE_URL:raw,NODE_ENV:'test',JWT_SECRET:'zeroone-isolated-test-key-not-for-production-2026',RESEND_API_KEY:'',ADMIN_ALERT_EMAIL:'',ENABLE_IP_GEOLOCATION:'false',WEBSITE_URL:'http://localhost:4312',ADMIN_URL:'http://localhost:4310'};
const root=path.resolve(__dirname,'..');
function run(args){const result=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});if(result.status!==0)process.exit(result.status||1);}
// Only creates/adds schema in this explicitly isolated database; no reset/force/data-loss flags.
run([require.resolve('prisma/build/index.js'),'db','push','--schema','backend/prisma/schema.prisma','--skip-generate']);
run([require.resolve('tsx/cli'),'--test','backend/tests/integration/database.integration.ts']);
