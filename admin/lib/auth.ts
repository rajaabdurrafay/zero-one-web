export const SESSION_TOKEN = 'gz-admin-session';
export const TOKEN_COOKIE = 'gz-admin-token';
export const ROLE_COOKIE = 'gz-admin-role';
export const USER_COOKIE = 'gz-admin-user';

export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'RECEPTIONIST';

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  avatarUrl?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export function validateSession(token: string | undefined): boolean {
  return Boolean(token && token.trim().length > 0);
}
