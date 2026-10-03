import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database, prisma } from '../src/db';
import { transactionalBooking } from '../src/middleware/transactionalBooking';

test('booking locks are ordered; helpers share transaction; response follows commit', async t => {
  const events: string[] = [];
  const tx: any = { $queryRaw: async (_sql: any,id: string) => {events.push('lock:'+id);}, booking: {findUnique:async()=>null}, addonItem:{findUnique:async()=>({id:'addon1'})} };
  t.mock.method(database, '$transaction', async (callback: any) => {const result=await callback(tx);events.push('commit');return result;});
  const handler=transactionalBooking(async (_req,res) => { assert.equal((await prisma.addonItem.findUnique({where:{id:'addon1'}}))?.id,'addon1');res.status(201).json({ok:true}); });
  const res: any={status(code:number){events.push('status:'+code);return this},json(body:any){events.push('send');assert.equal(body.ok,true);return this}};
  await handler({body:{items:[{resourceId:'z'},{resourceId:'a'}],addons:[{addonItemId:'addon1'}]},params:{}} as any,res,error=>{throw error});
  assert.deepEqual(events,['lock:a','lock:z','lock:addon1','commit','status:201','send']);
});

test('rejected request rolls back before sending an error', async t => {
  let committed=false,rolledBack=false,status=0;
  const tx:any={$queryRaw:async()=>[],booking:{findUnique:async()=>null}};
  t.mock.method(database,'$transaction',async(callback:any)=>{try{await callback(tx);committed=true}catch(error){rolledBack=true;throw error}});
  const handler=transactionalBooking(async(_req,res)=>res.status(409).json({error:'conflict'}));
  const res:any={status(code:number){status=code;return this},json(body:any){assert.equal(body.error,'conflict');return this}};
  await handler({body:{},params:{}} as any,res,error=>{throw error});
  assert.equal(committed,false);assert.equal(rolledBack,true);assert.equal(status,409);
});
