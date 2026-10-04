# Deployment and rollback

## Existing database

This branch requires the additive columns/indexes described in docs/SCHEMA_CHANGES.sql and docs/HANDOVER.md. With owner approval on 4 October 2026, these six columns and six indexes were applied to the existing Hostinger database after an encrypted recovery backup and an isolated local restore rehearsal. Do not blindly rerun this SQL. For other databases, inspect the actual schema, rehearse on an isolated restored copy, back up and obtain owner approval before applying missing additions. Do not run prisma db push, migrate dev, seed or the removed PostgreSQL theme migration against production. Establish a reviewed migration baseline before any future schema changes; the repository currently has no production migration history.

Before deployment, take an encrypted MySQL dump and a separate backup of backend/uploads. The sanitized dashboard JSON export is not a complete restoration source. Keep the old release and its configuration for rollback. Do not share .env files or database dumps with a source-code handover.

## Environment and routing

Deploy three applications: backend, website and admin. Use HTTPS for all public domains and configure the reverse proxy to the correct internal ports. The Hostinger website deployment was inspected on 4 October 2026 and follows GitHub main automatically. Preserve its Webpack build and standalone-server packaging settings.

Backend:

- DATABASE_URL: mysql:// connection to the existing database; URL-encode special characters in credentials.
- NODE_ENV=production and the backend PORT selected by the host.
- JWT_SECRET: unique random key, 32+ characters; the known old fallback is rejected.
- WEBSITE_URL, ADMIN_URL and CORS_ORIGINS: exact HTTPS origins, comma-separated for CORS.
- TRUST_PROXY: only the actual trusted proxy addresses/subnets. Do not use an unrestricted true setting. Confirm real client IP resolution and rate limiting behind the host proxy. Same-origin relays otherwise aggregate backend rate limits by relay IP; a shared limiter/client-identity design is needed if traffic grows.
- REVALIDATE_SECRET: unique server-only key matching the website value.
- RESEND_API_KEY and verified email sender configuration for password-reset/login emails. Current reset sender is onboarding@resend.dev; replace with a verified sender before sending to arbitrary customer addresses.
- Payment account settings from backend/.env.example: supply real values. Existing fallback display numbers are demo placeholders.
- ENABLE_IP_GEOLOCATION is false by default. Enabling it sends approximate IP lookups to an external service; review the provider and policy first.
- ENABLE_BOOKING_AUTOMATION must explicitly equal true to run booking expiry/reminder jobs. Preserve the existing production opt-in; do not enable jobs as part of a UI release.
- UPLOADS_DIR optionally overrides file storage. All upload writers/readers share the same resolver. On Hostinger production, a working directory under hbuilds uses hbuilds/uploads, outside current/versions; copy existing uploads there before the first release. Other hosts/local development default to cwd/uploads. Persist and back up this directory; do not place private receipts in frontend public directories.

Website/admin:

- API_URL: reachable server-side backend origin.
- NEXT_PUBLIC_API_URL: public HTTPS backend origin used by image URLs; baked into client builds, so rebuild when changing it.
- Website REVALIDATE_SECRET: same as backend; never prefix with NEXT_PUBLIC_.

Use npm ci --include=dev for build installations, then npm run build. Build backend before running backend tests so the Prisma client is generated. Use individual workspace build scripts if the host manages separate apps. Keep root package-lock.json and workspace structure intact.

Hostinger backend entry file must be backend/dist/server.js. Hosted runtimes require the entry module, so the dedicated entry calls startServer() directly; index.js remains safe to import in tests. Production-only installations also need the backend TypeScript declaration packages, including @types/compression.

Use npm run start:backend (workspace cwd ensures backend/uploads path), next start -p HOST_PORT for each frontend, or the configured root frontend start scripts for the documented default ports. Persist backend/uploads across releases. Do not clean uploaded files without database reference checks and a backup.

## Release validation

Run the committed regression tests, typechecks, lint and production dependency audit. Run the frontend fixture smoke test after builds. On an isolated STAGING MySQL copy, validate simultaneous booking attempts, group verification, rejection/resubmission stock, expiry, cancellation, live-session billing, PDF/Excel exports, real staff roles, password-reset emails and upload persistence. These real database/email/browser flows were not exercised against live services in this pass.

Confirm cookies have HttpOnly/Secure/SameSite flags over HTTPS; new sessions are required. Check that revoked devices and deactivated staff are denied. Verify unauthorized booking lists/updates and payment images fail. Check cache refresh with matching secrets, and confirm incorrect secrets fail.

Rate limits use process-local memory. Multi-instance hosting needs a shared rate-limit store. Database row-lock behavior needs staging MySQL/InnoDB verification. Guest tokens are 24-hour capabilities kept in sessionStorage; refreshing the same tab preserves them, but closing it removes them. Recover older guest bookings through staff or a verified account.

## Rollback

Stop the new apps, restore the previous code release and its matching configuration, reinstall with that release's lockfile and rebuild. Prefer code rollback with additive schema columns/indexes retained. Never remove them or restore data without a separate reviewed plan and owner approval. Restore the database only for confirmed data corruption, using an agreed maintenance window; routine code rollback does not require a data restore. Preserve uploads created after deployment. Rotated authentication keys invalidate sessions; staff and customers sign in again.
