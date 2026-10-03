import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {versionedApi,pagination,pageResult} from '../src/middleware/apiContract';
import {publicCache} from '../src/middleware/publicCache';
test('v1 provides envelopes and pagination; errors preserve HTTP status; legacy remains compatible',async()=>{
  const app=express();app.use(versionedApi);
  app.get('/api/items',(req,res)=>{const page=pagination(req,res);pageResult(res,7,page.page,page.limit);res.json([{id:1}])});
  app.get('/api/fail',(_req,res)=>res.status(409).json({error:'Occupied'}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as any).port;
  try{
    const page=await fetch(base+'/api/v1/items?page=2&limit=3');assert.deepEqual(await page.json(),{success:true,data:[{id:1}],meta:{pagination:{total:7,page:2,limit:3,totalPages:3}}});
    const failed=await fetch(base+'/api/v1/fail');assert.equal(failed.status,409);assert.deepEqual(await failed.json(),{success:false,error:{code:'CONFLICT',message:'Occupied'}});
    assert.deepEqual(await (await fetch(base+'/api/items')).json(),[{id:1}]);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
});
test('public cache excludes authenticated reads and invalidates after successful mutations',async()=>{
  const app=express();app.use(publicCache);let calls=0;
  app.get('/api/pricing',(_req,res)=>res.json({calls:++calls}));app.post('/api/pricing',(_req,res)=>res.json({ok:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as any).port;
  try{
    const get=async(headers?:Record<string,string>)=>(await(await fetch(base+'/api/pricing',{headers})).json()).calls;
    assert.equal(await get(),1);assert.equal(await get(),1);assert.equal(await get({Authorization:'Bearer private'}),2);
    await fetch(base+'/api/pricing',{method:'POST'});assert.equal(await get(),3);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
});
