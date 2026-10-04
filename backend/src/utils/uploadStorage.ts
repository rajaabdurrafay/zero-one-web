import path from 'node:path';

/** Hostinger swaps version directories; uploads must live outside those releases. */
export function getUploadsRoot(cwd = process.cwd(), configured = process.env.UPLOADS_DIR, production = process.env.NODE_ENV === 'production'): string {
  if (configured?.trim()) return path.resolve(cwd, configured.trim());
  if (production) {
    let directory = path.resolve(cwd);
    while (true) {
      if (path.basename(directory) === 'hbuilds') return path.join(directory, 'uploads');
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  return path.resolve(cwd, 'uploads');
}
