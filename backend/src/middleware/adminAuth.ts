import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken, AdminTokenPayload, AdminRole } from '../utils/auth';

export interface AuthenticatedAdminRequest extends Request {
  admin?: AdminTokenPayload;
}

export function requireAdminAuth(allowedRoles?: AdminRole[]) {
  return (req: AuthenticatedAdminRequest, res: Response, next: NextFunction) => {
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
