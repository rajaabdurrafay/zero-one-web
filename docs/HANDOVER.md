# ZeroOne developer handover

Updated 3 October 2026. Branch: optimize-finalize. No deployment, production DB tests, production migrations or push were performed. New work follows preserved baseline commits daba508, 87aca0a and 402d935; existing pending edits/removals were committed separately before implementation. Foundation commit 450d9fb introduces the shared utility and additive schema. Current-pass code commits are listed in the final verification report.

## Architecture and ownership

npm monorepo: backend (Express 4 / Prisma 5.22 / MySQL), website and admin (Next.js 16 / React 19), shared (@zeroone/domain). Node 24 was used locally. Backend routes are authoritative; both websites use same-origin API relays with HttpOnly cookies. SUPER_ADMIN, MANAGER and RECEPTIONIST permissions remain enforced on the backend.

Read README.md, docs/API.md, docs/DEPLOYMENT.md and relevant frontend AGENTS.md before changing behavior. Keep secrets, uploads, database exports, node_modules and generated builds outside source control. .gitignore permits only the reviewed docs/SCHEMA_CHANGES.sql among SQL files.

## Booking and billing invariants

- Resource writers take ordered FOR UPDATE locks inside a ReadCommitted transaction. Booking/group/session/stock helpers share the transaction; responses are sent after commit. Concurrent overlap returns 409; adjacent intervals are allowed. Every future booking writer must use this locking protocol; there is no database-native exclusion constraint.
- Active RUNNING/PAUSED sessions block public availability and overlapping bookings. Walk-in starts obey operational flags. Open-ended COUNT_UP occupies the resource until stop and refuses a start if future reservations exist; this deliberately conservative policy avoids selling an unknown end time.
- Start, pause, resume, extension and stop are transactional. Extension/resume check reservations before changing time or price. Linked starts align reservation start/end to actual start. Closed/expired reservations cannot reopen through payment upload/status edits. Active sessions prevent incompatible cancellation/rescheduling.
- Stop is atomic and idempotent. A direct walk-in creates one completed booking and persists its ID on the session. Retried/concurrent stops return the same final amount. Paused time is excluded. History and final receipt links survive reload.
- shared/index.js defines Asia/Karachi dates, canonical Pakistani mobile numbers, elapsed seconds, rounding, activity pricing, discounts, add-ons and exact-paisa group payment allocation. Activity/discount amounts preserve the prior whole-rupee policy; add-ons retain paisa. Hourly configured full/half-hour tiers remain the existing policy rather than a new tariff.
- New bookings/sessions snapshot the configured rate and offer. Reschedule/extension/count-up stop calculate a complete quote, preserve discounts/add-ons and reconcile group totals; payment allocation does not count group payments twice. No live rate values were changed.
- Legacy records without a snapshot use currently configured pricing at their first modification. Historical rates cannot be reconstructed from missing data; review affected old bookings before release. Client live bills are estimates; the backend final bill is authoritative.
- Stock updates are conditional/atomic. Repeated rejection/cancellation cannot replenish twice; reactivation checks both stock and reservation occupancy. Group add-ons attach once.

## Accounts and security

Canonical nullable-unique accountPhone/accountEmail fields prevent concurrent duplicate signup. Unregistered guest rows stay separate; signup never claims historical records by phone alone. Existing registered accounts claim their canonical key only after a valid password login; ambiguous duplicates require staff review. Manager/super-admin may explicitly link matching guest history with a verification note; the historical guest row remains and an audit record is recorded. No automated merge/phone OTP is implemented.

Customer auth validates the current account, credential tag and authVersion. Logout increments authVersion and revokes all customer devices. Expiring hashed reset tokens use a one-time conditional update; guest records cannot reset into registered accounts. Staff manual reset targets the selected identity, not every matching phone. Actual reset email delivery still needs verified Resend configuration and a real-service check.

Preserved baseline protections include scrypt passwords/legacy upgrade, purpose-separated signed JWTs, current-role/live-device admin checks, same-origin CSRF checks, guest capability access, private signed payment-image URLs, safe nested customer fields, image magic-byte/MIME/size validation, Helmet, compression, CORS, rate limits, sanitized errors and audit exports. Device attendance now closes only the logged-out device and uses Karachi dates.

Popup links reject executable schemes; theme CSS/font/logo fields are constrained. CSV exports escape spreadsheet formula prefixes. Staff removal deactivates; offers/add-ons archive rather than deleting referenced history. Uploaded file replacement remains filesystem work and is not atomic with MySQL. No new bulk file cleanup was performed.

## Performance and frontend changes

Dashboard counts/revenue and customer aggregates use database aggregates/selects instead of full related history. Booking list is server-paginated; availability is batched; dashboard/notification requests share SWR keys. Session cards maintain their own timer state so the whole screen does not rerender every second. Public catalog cache is bounded, lasts 10 seconds, excludes authenticated/admin reads, and invalidates after successful mutations; multi-process instances may remain stale for that TTL.

Uploads have configured Next image origins; brand/gallery images use Next optimization and gallery lightbox loads dynamically when opened. Hardcoded backend image origins were replaced with the configured origin. Demo price/reel/fake rating fallbacks no longer represent live business data. Session screen shows estimated bill, optional collected payment, final receipt and bounded recent history.

Legacy API compatibility remains; /api/v1 adds consistent JSON envelopes and bounded pagination where supported. Binary endpoints stay binary. Some legacy lists and analytical exports still load larger datasets; there is no blanket claim that every route is paginated or every query optimized.

## Schema transition: approval required before real DB use

Review docs/SCHEMA_CHANGES.sql. It was generated by a schema-to-schema diff, without a production connection: nullable Customer accountPhone/accountEmail and unique indexes, authVersion default 0; nullable Booking/Session pricingSnapshot; AttendanceLog loginSessionId; supporting indexes. No DROP, reset, destructive rewrite or data backfill is included. Existing rows remain intact; nullable canonical keys allow historical guests.

The new code requires these columns. Do not start it against an unchanged existing DB. There is no established production Prisma migration history, so do not use migrate dev/db push as a production shortcut. A database administrator must compare the actual existing schema, confirm MySQL/InnoDB compatibility, rehearse the additive SQL on an isolated restored copy, assess locks, take a verified backup and obtain owner approval. This work prepared SQL only; it did not apply it outside the local test DB. Roll back code while retaining additive columns/indexes; removing them is a separate reviewed destructive change.

## Verification and limits

Baseline before Phase 2: all three builds/type-checks passed, 18 database-free tests passed. Current checks/results are recorded in docs/VERIFICATION.md. Database tests use explicit guarded TEST_DATABASE_URL on localhost with zeroone_test_* names. Local MariaDB 11.4 fixtures were isolated from production, external email/geolocation disabled, and retained without DB reset/delete. CI adds isolated MySQL 8 tests but has not run remotely because no push was performed.

Coverage includes simultaneous reservations, adjacent intervals, extension conflicts/tier totals, atomic concurrent stop, walk-in occupancy, pause billing, snapshots/discounts/add-ons, exact group payment allocation, canonical signup races, logout/reset invalidation, verified guest claims, malformed API input, safe content/archive and device attendance. Frontend fixture checks exercise production handlers, cookies, relay auth, CSRF, server-side theme loading, backend logout and security headers. These are meaningful regression checks, not a full browser UX certification or penetration test.

Retained release work: real MySQL/version staging rehearsal, production migration-baseline decision, duplicate-account review, verified email sender/delivery, TLS/proxy/routing, persistent uploads and backup restore rehearsal. Rate limiting is process-local; multi-instance hosting needs a shared store and trusted client identity configuration. Phone OTP, payment gateway settlement and a dedicated mobile app are outside this scope. Never deploy, modify production DB, delete data/files or push without the owner's applicable approval.

## Isolated Laragon local setup (2026-10-03)

See docs/LOCAL_DEVELOPMENT.md. The local launcher checks existing zeroone_dev, uses private .local configuration/uploads/email outbox, and starts website 3002, admin 3000 and API 3001 on loopback. No production DB changes, resets, password resets, push or deployment were performed. Existing admin edits from other work remain separate and need feature-level review. Hostinger GitHub auto-deployment settings have not been independently verified.
