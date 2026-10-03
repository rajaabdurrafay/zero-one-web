import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

export const database = new PrismaClient({
  log: ['error', 'warn']
});

const transactionContext = new AsyncLocalStorage<Prisma.TransactionClient>();
export function withinTransaction<T>(transaction: Prisma.TransactionClient, operation: () => Promise<T>): Promise<T> {
  return transactionContext.run(transaction, operation);
}
// Route helpers share the request's transaction without a global mutable client.
export const prisma = new Proxy(database, {
  get(target, property) {
    const client = transactionContext.getStore() || target;
    const value = Reflect.get(client, property);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
