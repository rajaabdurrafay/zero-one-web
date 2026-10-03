import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalRuntime} from '../src/utils/localRuntime';
import {saveLocalEmail} from '../src/utils/localEmail';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('local safety guard is opt-in and refuses remote DB or production mode', async()=>{
  const saved={...process.env};
  try {
    delete process.env.ZEROONE_LOCAL_ONLY;
    assert.doesNotThrow(assertLocalRuntime);
    assert.equal(await saveLocalEmail({to:'nobody@example.test',subject:'test',text:'test'}),false);
    Object.assign(process.env,{ZEROONE_LOCAL_ONLY:'true',HOST:'127.0.0.1',NODE_ENV:'development',DATABASE_URL:'mysql://localhost/zeroone_dev'});
    assert.doesNotThrow(assertLocalRuntime);
    process.env.DATABASE_URL='mysql://production.example/zeroone_dev';
    assert.throws(assertLocalRuntime);
    await assert.rejects(saveLocalEmail({to:'nobody@example.test',subject:'test',text:'test'}));
    process.env.DATABASE_URL='mysql://localhost/zeroone_dev';
    const outbox=await fs.mkdtemp(path.join(os.tmpdir(),'zeroone-local-mail-'));
    process.env.LOCAL_EMAIL_OUTBOX=outbox;
    const message={to:'nobody@example.test',subject:'Local reset test',text:'http://localhost:3002/reset-password?token=dummy'};
    assert.equal(await saveLocalEmail(message),true);
    const files=await fs.readdir(outbox);
    assert.equal(files.length,1);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(outbox,files[0]),'utf8')),message);
    process.env.NODE_ENV='production';
    assert.throws(assertLocalRuntime);
    process.env.NODE_ENV='development';process.env.HOST='0.0.0.0';
    assert.throws(assertLocalRuntime);
  } finally {
    for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
    Object.assign(process.env,saved);
  }
});
