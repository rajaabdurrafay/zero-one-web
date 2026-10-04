import { isSameOriginRequest } from '@zeroone/domain';
export function hasValidOrigin(request: Request): boolean {
  // The hosting proxy's internal URL is not the browser's public origin.
  const origin = process.env.APP_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://admin-zeroone.exocorastudio.com' : undefined);
  return isSameOriginRequest(request, origin);
}
