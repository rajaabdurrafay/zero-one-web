import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken, credentialTag, AdminTokenPayload, AdminRole } from '../utils/auth';

import { prisma } from '../db';

export interface AuthenticatedAdminRequest extends Request {
  admin?: AdminTokenPayload;
}

export function requireAdminAuth(allowedRoles?: AdminRole[]) {
  return async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const customToken = req.headers['x-admin-token'] as string | undefined;

      let token: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (customToken) {
        token = customToken;
      }

      if (!token) {
        return res.status(401).json({ error: 'Authentication required. No admin token provided.' });
      }

      const payload = verifyAdminToken(token);
      if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired admin session token.' });
      }

      const account = await prisma.adminUser.findUnique({ where: { id: payload.id } });
      if (!account?.isActive || credentialTag(account.password) !== payload.credentialTag) return res.status(401).json({ error: 'Account or session is no longer active.' });
      const session = await prisma.loginSession.findUnique({ where: { id: payload.sessionId }, select: { adminUserId: true } });
      if (!session || session.adminUserId !== account.id) return res.status(401).json({ error: 'Device session revoked. Please login again.' });
      payload.role = account.role;
      payload.name = account.name;
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({
          error: `Access denied. Role '${payload.role}' is not authorized for this action.`,
          requiredRoles: allowedRoles,
        });
      }

      req.admin = payload;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Internal error during admin authorization' });
    }
  };
}
