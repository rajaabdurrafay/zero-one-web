import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isSameOriginRequest} from '@zeroone/domain';
test('public origin survives an internal proxy URL and rejects forged or missing origins', () => {
  const origin='https://admin-zeroone.exocorastudio.com';
  const make=(value:string|null,forwarded=origin)=>({url:'http://127.0.0.1:3000/api/auth/login',headers:new Headers({...(value ? {origin:value}:{}),'x-forwarded-host':forwarded})});
  assert.equal(isSameOriginRequest(make(origin),origin),true);
  for(const value of [null,'null','https://attacker.invalid','http://admin-zeroone.exocorastudio.com',origin+'.attacker.invalid',origin+':444']) assert.equal(isSameOriginRequest(make(value),origin),false);
  assert.equal(isSameOriginRequest(make('https://attacker.invalid','attacker.invalid'),origin),false);
  assert.equal(isSameOriginRequest(make(origin),'not a URL'),false);
  assert.equal(isSameOriginRequest({url:'http://localhost:3002/login',headers:new Headers({origin:'http://localhost:3002'})}),true);
});
