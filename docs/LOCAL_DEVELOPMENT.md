# Isolated local development

This setup runs the customer website, staff dashboard and API against Laragon's existing local MySQL `zeroone_dev`. It does not push, deploy, import data, reset the database or apply schema changes.

## Start and stop

1. Open Laragon and start MySQL.
2. Open a terminal in this project folder. Use Node.js 22 or newer; install dependencies with `npm ci` only if they are missing.
3. Run `npm run local:doctor` to check the local database.
4. Run `npm run dev:local` and keep that terminal open.

Customer website: http://localhost:3002

Staff dashboard: http://localhost:3000

API health: http://localhost:3001/health

Use the existing local staff login. No password has been reset. Stop with Ctrl+C; Laragon MySQL remains running. Website/admin changes reload automatically. Restart the command after backend changes.

The old port 4322 preview used design fixtures; use these URLs for real local features. Stop other website/admin previews before starting this command. Occupied ports are refused rather than silently reused.

## Isolation

- The launcher accepts only loopback MySQL with the exact database name `zeroone_dev`. Runtime checks reject remote databases, production mode and public API binding in this local mode.
- First launch copies the existing local database URL into private `.local/config.json` and generates separate signing/revalidation keys. Existing environment files are preserved. The launcher supplies local API URLs to both frontends.
- Private local uploads live in `.local/backend/uploads`. Existing checkout uploads are copied once without deleting or overwriting the source. They are not synchronized to live hosting.
- Password-reset and staff login emails are saved as JSON in `.local/mail`, never sent through Resend in this mode. Read the reset link there to test the flow. These files contain private account information; do not share them.
- Payment instructions use clearly marked local test details. Geolocation is disabled. The setup is not an operating-system network firewall; dependencies, fonts and embedded maps can still use the internet.
- Website/API/admin listeners bind to this computer. This does not reconfigure Laragon's own MySQL listener or Windows firewall.
- `.local/`, environment files and uploads are excluded from Git. The local database persists between runs. Normal testing can create/update local bookings, accounts and sessions; startup automation can expire local pending bookings.

If the database check fails, verify Laragon and the local schema. No automatic schema repair, reset or seeding runs. Database concurrency tests have a separate `TEST_DATABASE_URL` guard requiring a local `zeroone_test_*` database; never point them at production or `zeroone_dev`.

## Code release versus data

Git push transfers tracked code. It does not transfer local customers, bookings, uploads, private configuration or the MySQL database.

The owner reports that Hostinger is linked to GitHub and previously updated after pushes. Treat a push as a possible live deployment until the configured deployment branch and build settings are verified in Hostinger. This local launcher does not change those settings.

Before any approved push: review status/diff, run relevant checks, confirm the target branch and Hostinger behavior. Live schema changes, data transfers and uploads are separate operations requiring review and approval. A code change can still affect the live application after deployment; local isolation does not certify release compatibility. Review `SCHEMA_CHANGES.sql` and the live schema before releasing code that requires new columns.

## Verification recorded for this setup

The local database readiness check finds 6 activities, 11 resources and 1 staff account. All 3 local safety tests and 30 backend regression tests pass without production connections. Backend compilation and all workspace type checks succeed. Website home, booking page, pricing proxy, admin login page, API health and pricing return HTTP 200.

The staff credentials saved in admin/.env.local return HTTP 401 against the existing local database. This does not prove the existing account is broken; use its actual password or authorize a separate local test account. No existing password was reset. These checks do not certify every changed admin feature or a production deployment.
