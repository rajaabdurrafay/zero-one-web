export function assertLocalRuntime(): void {
  if (process.env.ZEROONE_LOCAL_ONLY !== 'true') return;
  const database = new URL(process.env.DATABASE_URL || '');
  if (process.env.NODE_ENV === 'production' || database.protocol !== 'mysql:' ||
      !['localhost','127.0.0.1','[::1]'].includes(database.hostname) || database.pathname !== '/zeroone_dev' ||
      database.search || database.hash || process.env.HOST !== '127.0.0.1') {
    throw new Error('Isolated local mode refuses remote/production databases or public binding.');
  }
}
