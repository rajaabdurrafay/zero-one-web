import { saveLocalEmail } from './localEmail';
import crypto from 'crypto';
import { Resend } from 'resend';

export interface DeviceInfo {
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  location: string;
}

/**
 * Parses user agent into human-readable browser and OS names
 */
export function parseUserAgent(ua: string): { browser: string; os: string } {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  if (!ua) return { browser, os };

  // OS Detection
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Browser Detection
  if (/edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  return { browser, os };
}

/**
 * Extracts and normalizes IP address from Express Request
 */
export function extractClientIp(req: any): string {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Generates a consistent hash fingerprint for the browser + IP combo
 */
export function generateDeviceFingerprint(ipAddress: string, userAgent: string): string {
  const normalizedUa = (userAgent || '').trim().toLowerCase();
  const normalizedIp = (ipAddress || '').trim();
  return crypto
    .createHash('sha256')
    .update(`${normalizedIp}:::${normalizedUa}`)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Attempts to resolve approximate location from IP
 */
export async function getApproximateLocation(ip: string): Promise<string> {
  if (process.env.ENABLE_IP_GEOLOCATION !== 'true') return 'Location lookup disabled';
  // Local or private IPs
  if (
    !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return 'Local Network / Development';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data: any = await response.json();
      if (data.status === 'success') {
        const parts = [data.city, data.regionName, data.country].filter(Boolean);
        return parts.join(', ') || 'Unknown Location';
      }
    }
  } catch {
    // Timeout or network lookup failed silently
  }

  return 'Unknown Location';
}

/**
 * Dispatches New Device Login Security Alert via Resend Email
 */
export async function sendNewDeviceLoginEmail(params: {
  toEmail: string;
  adminName: string;
  username: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  loginTime: Date;
}) {
  if (await saveLocalEmail({to: params.toEmail, subject: 'Local admin login notice', text: `A login for ${params.username} was detected. This is a local test notice.`})) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Security Alert] RESEND_API_KEY is not defined. Email alert skipped.');
    return;
  }

  const { browser, os } = parseUserAgent(params.userAgent);
  const formattedDate = params.loginTime.toLocaleString('en-PK', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Karachi',
  });

  const resend = new Resend(apiKey);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>New Login Alert</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1210; color: #f0f3f2; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #141c19; border: 1px solid #2a3b34; border-radius: 16px; overflow: hidden; }
          .header { background-color: #1c2924; padding: 24px; border-bottom: 1px solid #2a3b34; text-align: center; }
          .header h1 { margin: 0; color: #d4a94f; font-size: 20px; font-weight: 700; }
          .body { padding: 28px 24px; }
          .alert-badge { display: inline-block; background-color: rgba(212, 169, 79, 0.15); color: #d4a94f; border: 1px solid rgba(212, 169, 79, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; }
          .card { background-color: #0b0f0e; border: 1px solid #22302a; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1a2520; font-size: 13px; }
          .item:last-child { border-bottom: none; }
          .label { color: #889990; }
          .value { color: #ffffff; font-weight: 600; font-family: monospace; }
          .footer { background-color: #0f1714; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7d75; border-top: 1px solid #22302a; }
          .warning { font-size: 13px; line-height: 1.6; color: #a4b5ad; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Zero One Gaming Lounge</h1>
          </div>
          <div class="body">
            <span class="alert-badge">Security Notification</span>
            <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #ffffff;">New Super Admin Login Detected</h2>
            <p style="margin: 0; font-size: 14px; color: #a4b5ad; line-height: 1.5;">
              Hello <strong>${params.adminName}</strong> (@${params.username}), a sign-in to your Zero One Admin account was recognized from an unrecognized browser or IP address.
            </p>

            <div class="card">
              <div class="item">
                <span class="label">Time (PKT)</span>
                <span class="value">${formattedDate}</span>
              </div>
              <div class="item">
                <span class="label">Device & Browser</span>
                <span class="value">${browser} on ${os}</span>
              </div>
              <div class="item">
                <span class="label">IP Address</span>
                <span class="value">${params.ipAddress}</span>
              </div>
              <div class="item">
                <span class="label">Approx. Location</span>
                <span class="value">${params.location}</span>
              </div>
            </div>

            <p class="warning">
              <strong>If this was you</strong>, you can safely ignore this email. This device is now registered in your recognized sessions.<br><br>
              <strong>If you did NOT perform this login</strong>, please change your password immediately in the Admin Panel to secure your administrative privileges.
            </p>
          </div>
          <div class="footer">
            Zero One Gaming Lounge &bull; Automated Security Service
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const result = await resend.emails.send({
      from: 'Zero One Security <onboarding@resend.dev>',
      to: params.toEmail,
      subject: `[Security Alert] New Login to Your ZeroOne Admin Account (@${params.username})`,
      html: htmlContent,
    });
    console.log(`[Security Alert] New device login email sent to ${params.toEmail}:`, result);
  } catch (err) {
    console.error('[Security Alert] Failed to dispatch login alert email:', err);
  }
}
