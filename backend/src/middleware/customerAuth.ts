import { Request, Response, NextFunction } from 'express';
import { verifyToken, credentialTag } from '../utils/auth';
import { prisma } from '../db';
export interface AuthenticatedCustomerRequest extends Request { customer?: { customerId: string; phone: string; name: string } }
async function authenticate(req: AuthenticatedCustomerRequest): Promise<boolean> {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;
  const payload = verifyToken(header.slice(7).trim());
  if (!payload) return false;
  const account = await prisma.customer.findUnique({ where: { id: payload.customerId } });
  if (!account?.password || !account.isRegistered || credentialTag(account.password) !== payload.credentialTag) return false;
  req.customer = { customerId: account.id, phone: account.phone, name: account.name };
  return true;
}
export async function requireCustomerAuth(req: AuthenticatedCustomerRequest, res: Response, next: NextFunction) {
  try { if (!await authenticate(req)) return res.status(401).json({ error: 'Invalid or expired session. Please login again.' }); next(); } catch(error) { next(error); }
}
export async function optionalCustomerAuth(req: AuthenticatedCustomerRequest, res: Response, next: NextFunction) {
  try { await authenticate(req); next(); } catch(error) { next(error); }
}
