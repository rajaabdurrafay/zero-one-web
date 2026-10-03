# ZeroOne

For real local testing with Laragon MySQL, run `npm run local:doctor` then `npm run dev:local`. Website: http://localhost:3002; admin: http://localhost:3000. See [isolated local setup](docs/LOCAL_DEVELOPMENT.md) for private uploads, email outbox and release boundaries.

Gaming lounge booking and operations: Express/Prisma/MySQL API, Next.js customer website and staff dashboard, plus shared pricing/timezone utilities.

## Workspace

- backend/src: authentication, booking transactions, billing, stock, reports and content APIs.
- backend/prisma/schema.prisma: MySQL schema; review additive changes in docs/SCHEMA_CHANGES.sql before using an existing database.
- shared: @zeroone/domain pricing, payment allocation, elapsed time, Asia/Karachi dates and phone normalization.
- website: customer registration/login, bookings, payments, profile and public content.
- admin: operations, countdown/count-up sessions, final receipts, staff, attendance and reports.
- backend/tests: unit/security tests and isolated database integration tests.
- docs/HANDOVER.md: behavior, verification, schema transition and remaining limits.
- docs/API.md: versioned API contract and pagination.
- docs/DEPLOYMENT.md: future hosting checklist; no deployment was performed.

## Local setup

Use Node 22+ (verified with Node 24) and run npm ci at the root. Copy each .env.example to backend/.env or frontend .env.local. Example files intentionally contain variable names only.

Set DATABASE_URL to a local development MySQL database, unique JWT_SECRET and matching backend/website REVALIDATE_SECRET (32+ random characters each). Set backend PORT=3001, WEBSITE_URL=http://localhost:3002, ADMIN_URL=http://localhost:3000 and matching CORS_ORIGINS. Set both frontend API_URL and NEXT_PUBLIC_API_URL to the backend origin; API_URL is server-only. Enable TRUST_FRONTEND_PROXY_HEADERS only behind a verified trusted frontend proxy. Fill real payment and Resend settings when needed. Backend enforces Asia/Karachi.

Schema generation: npm run db:generate --workspace=backend. Schema initialization belongs only on a new disposable development database. Never run db push, migrate dev or seed against production. Existing databases require reviewed additive schema changes, a backup and a maintenance plan; this repository has no established production migration history. Demo seeding requires SEED_ADMIN_PASSWORD (12+ characters) and is blocked in production.

Run npm run dev:backend, npm run dev:admin and npm run dev:website in separate terminals; default ports are 3001, 3000 and 3002.

## Verification

- npm run build: backend and both production frontends.
- npm run typecheck: all four workspaces.
- npm test: database-free security, pricing and transaction regression tests.
- npm run test:db: isolated local integration tests. Explicit TEST_DATABASE_URL must use mysql, localhost/127.0.0.1, and a database named zeroone_test_*. The runner applies schema only there, disables external email/geolocation, and refuses other targets. Fixtures are retained; it never resets/deletes the database.
- npm run lint: frontend lint; remaining warnings are visible technical debt.
- npm run test:frontends: built frontend handlers against an HTTP fixture on ports 4310/4312; no real API/database.
- npm run audit:production: runtime dependency audit.

CI uses an isolated MySQL 8 service for database tests. Local concurrency/billing tests were run on MariaDB 11.4, not production. See handover for results and limits. Build/typecheck/tests do not authorize release, schema application or push.
