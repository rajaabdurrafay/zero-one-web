import { isSameOriginRequest } from '@zeroone/domain';
export function hasValidOrigin(request: Request): boolean {
  const origin = process.env.APP_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://zeroone.exocorastudio.com' : undefined);
  return isSameOriginRequest(request, origin);
}
