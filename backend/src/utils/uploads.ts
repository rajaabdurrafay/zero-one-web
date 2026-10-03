import path from 'path';
import fs from 'fs';

export function decodeImage(value: unknown, maxMegabytes = 5): { buffer: Buffer; extension: string } {
  if (typeof value !== 'string' || value.length > Math.ceil(maxMegabytes * 1024 * 1024 * 4 / 3) + 100) throw new Error('Image exceeds size limit.');
  const match = value.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error('Use a PNG, JPEG, WebP or GIF image data URL. SVG and arbitrary files are not allowed.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > maxMegabytes * 1024 * 1024) throw new Error('Image exceeds size limit.');
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const valid = extension === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : extension === 'jpg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
    : extension === 'webp' ? buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    : ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6));
  if (!valid) throw new Error('Image content does not match its declared type.');
  return { buffer, extension };
}

export function deleteLocalUpload(url: string, folder: string): void {
  const prefix = '/uploads/' + folder + '/';
  if (!url.startsWith(prefix)) return;
  const name = url.slice(prefix.length);
  if (!name || name !== path.basename(name) || name.includes('\\') || name.includes('..')) return;
  const base = path.resolve(process.cwd(), 'uploads', folder);
  const target = path.resolve(base, name);
  if (path.dirname(target) !== base) return;
  if (fs.existsSync(target) && !fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target);
}
