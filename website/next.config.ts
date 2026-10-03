import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images:{remotePatterns:[{protocol:(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').startsWith('https:') ? 'https':'http',hostname:new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').hostname,port:new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').port,pathname:'/uploads/**'}]},
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
    ] }];
  },
};
export default nextConfig;
