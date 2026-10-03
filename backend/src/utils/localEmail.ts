import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertLocalRuntime } from './localRuntime';

// Explicit local mode only. This never sends mail and never exposes the outbox by HTTP.
export async function saveLocalEmail(message: {to: string; subject: string; text: string}): Promise<boolean> {
  if (process.env.ZEROONE_LOCAL_ONLY !== 'true') return false;
  assertLocalRuntime();
  const folder = process.env.LOCAL_EMAIL_OUTBOX;
  if (!folder) throw new Error('Local email outbox path is missing.');
  await fs.mkdir(folder, {recursive:true});
  await fs.writeFile(path.join(folder, `${Date.now()}-${crypto.randomUUID()}.json`), JSON.stringify(message,null,2), {mode:0o600});
  console.log('Local email saved to the private .local/mail outbox; nothing sent.');
  return true;
}
