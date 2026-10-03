# ZeroOne Web

Gaming lounge booking and operations software. This npm workspace contains an Express/Prisma/MySQL API, a Next.js customer website, and a Next.js staff/admin dashboard.

## Structure

- backend/src: API routes, authentication, booking automation, stock and session logic.
- backend/prisma/schema.prisma: existing MySQL schema. This hardening pass did not change it.
- backend/tests: database-free security, transaction and export regression tests.
- website: customer booking, payment submission, profile, reviews and public content.
- admin: booking management, live sessions, staff, attendance, analytics and content/settings.
- scripts/smoke-frontends.cjs: production frontend handler checks against a disposable backend fixture.
- docs/HANDOVER.md: architecture, behavior changes, verification and remaining constraints.
- docs/DEPLOYMENT.md: environment, deployment and rollback procedure.

## Setup

Use Node.js 22 or later and npm with the committed package-lock.json.

1. Run npm ci from the repository root.
2. Copy backend/.env.example to backend/.env, and each frontend .env.example to .env.local.
3. Supply the existing MySQL DATABASE_URL and unique JWT_SECRET. Use at least 32 random characters.
4. Set the SAME REVALIDATE_SECRET in backend and website (at least 32 random characters).
5. Set API_URL for server-side frontend calls and NEXT_PUBLIC_API_URL for backend image URLs.
6. For a NEW, disposable development database only, deliberately initialize the schema. Do not run database initialization against an existing/live database. Set SEED_ADMIN_PASSWORD (12+ characters) before development demo seeding. Production seeding is blocked.

Generate a secret locally with node -e "console.log(require('crypto').randomBytes(48).toString('hex'))". Never commit its result.

Run the apps in separate terminals:

- npm run dev:backend: API on port 3001.
- npm run dev:admin: admin on port 3000.
- npm run dev:website: customer website on port 3002.

## Validation and production builds

- npm run build: generate Prisma client and build all three workspaces.
- npm run typecheck: TypeScript validation across all workspaces.
- npm test: database-free backend regression tests.
- npm run lint: both frontend lint checks; existing advisory warnings remain visible.
- npm run test:frontends: requires completed frontend builds; uses ports 4310/4312 and a disposable fixture, not the configured API/database.
- npm run audit:production: audit dependencies used at runtime.

Production commands: npm run start:backend, npm run start:admin, npm run start:website. Frontend start scripts default to ports 3000/3002; a managed hosting platform may supply its own explicit next start -p PORT command. See docs/DEPLOYMENT.md.

## Security and data handling

Admin and customer bearer tokens are held in HttpOnly, SameSite=Lax cookies through same-origin API relays. API authorization validates current accounts and credentials; admin tokens also require a live device-session record. Public booking administration is blocked. Guest booking access is scoped to one booking/group and expires after 24 hours. Payment screenshot links expire after 15 minutes.

New passwords use async scrypt; legacy PBKDF2 passwords are verified and upgraded after successful login. Existing sessions must sign in again after this release. Anonymous signup cannot claim historical guest bookings solely by matching a phone number; staff-assisted verification is needed for that workflow.

The dashboard JSON export omits credentials and is a business-data export, not a restorable database backup. Keep encrypted MySQL backups and backend/uploads separately. Secrets, uploads, database dumps, node_modules, build output and editor settings are excluded from the delivery archive.

No live database writes, migrations, emails or deployment were performed during verification. Read the handover for unverified integration requirements and retained development-tool advisories.
