const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn,execFileSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {root,localRoot,loadLocalConfig,localEnvironment}=require('./local-environment.cjs');
async function doctor(config) {
  const prisma=new PrismaClient({datasources:{db:{url:config.databaseUrl}},log:[]});
  try {
    const [activities,resources,admins]=await Promise.all([
      prisma.activity.count(),prisma.resource.count(),prisma.adminUser.count(),
    ]);
    await prisma.customer.findFirst({select:{accountPhone:true,accountEmail:true,authVersion:true}});
    await prisma.booking.findFirst({select:{pricingSnapshot:true}});
    await prisma.session.findFirst({select:{pricingSnapshot:true}});
    console.log(`Local MySQL ready: zeroone_dev (${activities} activities, ${resources} resources, ${admins} staff accounts).`);
    console.log('Config/uploads/email outbox: .local/ (ignored by Git). No remote email or geolocation.');
  } catch {
    throw Error('Local DB check failed. Start Laragon MySQL; verify .local/config.json and the local schema. No schema changes were attempted.');
  } finally { await prisma.$disconnect(); }
}
async function checkPort(port) {
  // Windows can permit overlapping binds; probe both addresses before reserving.
  const occupied=await Promise.all(['127.0.0.1','::1'].map(host=>new Promise(resolve=>{
    const socket=net.connect({port,host});
    const finish=value=>{socket.destroy();resolve(value);};
    socket.once('connect',()=>finish(true));
    socket.once('error',()=>finish(false));
    socket.setTimeout(500,()=>finish(false));
  })));
  if(occupied.some(Boolean))throw Error(`Port ${port} is occupied. Stop its existing local preview before starting the full system.`);
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.once('error',()=>reject(Error(`Port ${port} is occupied. Stop its existing local preview before starting the full system.`)));
    // Check a dual-stack listener so an existing IPv6 Next server is detected too.
    server.listen({port,host:'::',ipv6Only:false},()=>server.close(resolve));
  });
}
async function main() {
  const config=loadLocalConfig();
  await doctor(config);
  if(process.argv[2]==='doctor')return;
  if(process.argv[2] && process.argv[2]!=='start')throw Error('Use npm run local:doctor or npm run dev:local.');
  await Promise.all([3000,3001,3002].map(checkPort));
  const env=localEnvironment(config);
  // Copy only this checkout's local uploads once, without changing/deleting originals.
  const marker=path.join(localRoot,'uploads-copied');
  if(!fs.existsSync(marker)) {
    const source=path.join(root,'backend','uploads');
    if(fs.existsSync(source))fs.cpSync(source,path.join(localRoot,'backend','uploads'),{recursive:true,force:false,errorOnExist:false});
    fs.writeFileSync(marker,'Local source uploads copied; original folder retained.\n');
  }
  const children=[];
  let stopping=false;
  function stop(code=0) {
    if(stopping)return;
    stopping=true;
    for(const child of children) {
      if(process.platform==='win32' && child.pid) { try { execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}); } catch {} }
      else child.kill();
    }
    process.exitCode=code;
  }
  function launch(label,args,cwd) {
    const child=spawn(process.execPath,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    children.push(child);
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>process.stdout.write(`[${label}] ${chunk}`));
    child.on('error',()=>{console.error(`${label} failed to start.`);stop(1);});
    child.on('exit',code=>{if(!stopping){console.error(`${label} stopped (${code}); stopping local apps.`);stop(1);}});
  }
  launch('API',[require.resolve('tsx/cli'),path.join(root,'backend/src/index.ts')],path.join(localRoot,'backend'));
  launch('Website',[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','-p','3002'],path.join(root,'website'));
  launch('Admin',[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','-p','3000'],path.join(root,'admin'));
  process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
  console.log('FULL LOCAL SYSTEM — Website http://localhost:3002 | Admin http://localhost:3000 | API http://localhost:3001');
  console.log('Uses real local DB, not design fixtures. Ctrl+C stops apps. Laragon MySQL remains running.');
}
module.exports={checkPort};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
