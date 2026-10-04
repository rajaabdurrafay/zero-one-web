import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { decodeImage } from './uploads';
import { getUploadsRoot } from './uploadStorage';

export function processOfferBanner(value: string | null | undefined, uploadsRoot = getUploadsRoot()): string | null | undefined {
  if (!value || !value.startsWith('data:image/')) return value;
  const { buffer, extension } = decodeImage(value, 5);
  const directory = path.join(uploadsRoot, 'offers');
  const filename = `offer_${randomUUID()}.${extension}`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, filename), buffer, { flag: 'wx' });
  return `/uploads/offers/${filename}`;
}
