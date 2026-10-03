# ZeroOne developer handover

Prepared 3 October 2026. Code hardening and cleanup are complete for the changes listed here. Release to production still requires staging MySQL, email and hosting verification; this document replaces the earlier blanket “production-ready” claim.

## Project and architecture

ZeroOne is gaming lounge booking/operations software, not a general retail POS. The existing npm monorepo contains:

- backend: Express 4, TypeScript, Prisma 5.22, MySQL. Entry point backend/src/index.ts; schema backend/prisma/schema.prisma.
- website: Next.js 16.3.8 / React 19 customer website, booking, payment evidence, profiles and public content.
- admin: Next.js 16.3.8 / React 19 operations dashboard. Roles are SUPER_ADMIN, MANAGER and RECEPTIONIST.

Bookings, grouped activities, add-ons, payment verification, countdown/count-up live sessions, attendance, reporting, reviews, gallery, reels, appearance and operational settings exist in the code. Their full real-service workflows have not been re-certified solely because builds pass.

## Security fixes

1. Removed the reusable hardcoded JWT fallback. Production rejects missing/weak keys; development can use a random ephemeral key. The weak local key was replaced with a unique generated key without displaying it. Existing sessions must log in again.
2. JWT checks enforce HS256, purpose separation, expiry, issue time, structural identifiers and constant-time signature comparison. Customer and admin tokens cannot substitute for one another.
3. Admin authorization checks the current database account, active state, current role, credential tag and live LoginSession. Password changes, deactivation, logout and device deletion revoke applicable old tokens. Admin sessions expire after eight hours.
4. Customer authorization checks current account/credentials. Password changes invalidate old tokens. New passwords use async scrypt (N=32768, r=8, p=3); legacy PBKDF2 credentials upgrade after successful login.
5. Both frontends use server-side API relays and HttpOnly, Secure-in-production, SameSite=Lax session cookies. Browser JavaScript no longer stores actual bearer credentials. Customer localStorage contains a nonsecret cookie-session marker/profile cache only. Mutation relays and local login/logout handlers enforce same-origin requests.
6. Booking lists, reminders and administrative patches now require staff authentication. Booking detail/payment routes require a current owner/staff token or a signed capability for that exact booking/group. Guest capabilities expire after 24 hours and are kept in the current tab's sessionStorage.
7. Nested customer responses use explicit safe fields; password hashes and reset tokens are no longer returned in booking responses. Anonymous bookings no longer attach to registered accounts merely because a phone matches. Signup cannot claim historical guest records by phone alone; a staff-assisted/verified registration process is required.
8. Password reset tokens are stored as SHA-256 digests, expire after one hour, and use a conditional one-time update. Invalid credentials use a generic login error. Password length bounds and new eight-character minimums are aligned with the UI.
9. Added API/auth/submission limits, origin allowlists, Helmet headers, response compression, no-store API responses, generic production server errors and JSON 404 responses. IP tracking uses Express's trusted IP resolution rather than arbitrary client forwarding headers.
10. Images must be allowed raster data URLs with matching magic bytes and size limits. New SVG/arbitrary uploads are rejected. Branding target/mode and local deletion paths are constrained. Payment screenshots require signed image URLs expiring after 15 minutes; raw direct URLs are denied.
11. Cache revalidation requires a shared server-only secret. Matching local values were generated/configured without printing them. Failed refreshes no longer claim successful website invalidation.
12. Next.js was patched to 16.3.8. ExcelJS's transitive UUID was overridden to 11.1.1, with a round-trip workbook test. The Next.js deprecated middleware entry point was migrated to proxy.ts; rendered route guards use the authoritative backend role.

## Booking correctness and performance

- Booking/group creation, rescheduling, payment submissions, group verification, customer cancellation and live-session creation use commit-before-response transaction handling.
- Requests lock affected resources, bookings/groups and add-ons in stable order and use MySQL ReadCommitted isolation. Related helpers share the transaction through AsyncLocalStorage. Validation errors roll back prior writes before returning JSON.
- Group child writes and stock deductions roll back together. Duplicate add-on lines and overlapping activities on the same resource within a group are rejected; quantities and group size are bounded.
- Stock transitions use atomic increments and conditional decrements. Repeated rejection/cancellation cannot restock twice. Rejected payment resubmission reserves inventory again and rejects a slot taken by another booking. Expired unpaid holds restore inventory transactionally.
- Group resubmission adjusts sibling inventory; a parent is not fully confirmed while another child remains unconfirmed. Submitted screenshots enter AWAITING_VERIFICATION directly.
- Live sessions require a confirmed linked booking for the selected resource, and creation is serialized for the resource.
- Booking conflict detection uses findFirst rather than loading every overlapping booking. Review statistics use database aggregation rather than loading all ratings. Public review/reel limits are bounded.
- Expiry/completion automation throttles redundant polling-triggered writes; the server avoids overlapping background batches and closes the HTTP server/database client on shutdown.
- Theme responses are validated and fall back safely if incomplete; requests have timeouts. A production fixture test reproduced the missing-theme crash and verifies the fix.

## Cleanup and preserved data

27 files were archived and removed: 18 unreachable legacy home/motion/section components, five unused Next starter SVGs, two empty CLAUDE.md files, the redundant starter admin README, and the obsolete PostgreSQL-only theme migration script. The admin middleware.ts removal is a separate migration to proxy.ts, not a dropped feature. Unused lucide-react, mysql2 and deprecated @types/exceljs dependencies were removed.

Removed originals and the original handover are recoverable under the current chat's work directory. Environment files changed for local secrets have private local copies there. Those recovery files are deliberately absent from the delivery archive. The existing database, user uploads, data dumps and user image library were preserved. No database schema migration was made.

Automatic approval review rejected recursive removal of .next cache/dev directories with “blocked by policy.” Local generated caches remain. They, node_modules, build output, .git, real .env files, uploads and database backups are excluded from the clean ZIP.

## Verification performed

| Check | Result |
| --- | --- |
| Backend production build / Prisma client generation | Pass |
| Website Next.js production build | Pass |
| Admin Next.js production build | Pass |
| TypeScript across three workspaces | Pass |
| Database-free backend regression tests | 18 passed |
| Production frontend fixture smoke test | Pass: admin/customer cookies, token relay, CSRF, forged session, logout, cache auth, security headers |
| Frontend lint | 0 errors; admin 171 warnings, website 57 warnings |
| Production dependency audit | 0 vulnerabilities |
| Full dependency audit | 5 high advisories in development lint tooling |
| Git whitespace check | Pass |

Tests mock database operations or use a disposable HTTP fixture. They did not connect to or modify the live database, send email, deploy apps, or use real customer credentials. Real MySQL locking and end-to-end operating workflows still need staging tests.

Lint migration policy keeps explicit-any and effect-based synchronization as visible warnings; they were not all refactored away. Other correctness errors found by lint were fixed. Warning totals are retained technical debt, not a claim of warning-free code. Full audit flags the braces/micromatch/fast-glob chain in eslint-config-next; do not apply npm audit fix --force's suggested Next lint downgrade blindly.

## Commands and operation

Use Node 22+ (verified locally with Node 24), npm ci and the committed lockfile. Configure backend/.env and frontend .env.local from the committed .env.example files. MySQL is the actual provider; the old PostgreSQL README/setup was replaced.

Run npm run build, npm run typecheck, npm test, npm run lint, npm run test:frontends and npm run audit:production from the root. The frontend smoke test requires builds and free ports 4310/4312. Development/default start ports are backend 3001, admin 3000 and website 3002. Production hosts can supply their own explicit next start -p PORT commands.

See docs/DEPLOYMENT.md for exact environment names, proxy and HTTPS setup, upload persistence, backups, staging checks and rollback. CI validation is included with GitHub Actions pinned to verified commit SHAs; no workflow was pushed/run remotely.

## Remaining release requirements and limits

- Confirm existing MySQL schema/engine compatibility and simultaneous booking/stock/session behavior on an isolated staging copy. A reviewed migration baseline is still absent; do not run db push/migrate/seed on production as a shortcut.
- Verify actual Hostinger build/start/routing configuration, TLS, trusted proxy addresses, persistent uploads and restoration of encrypted MySQL backups. Hosting was not accessed here.
- Configure real payment details and a verified Resend sender. Current password-reset sender onboarding@resend.dev is a development default. Verify delivery before relying on resets.
- Rate limiting is process-local and relayed requests can share an IP bucket. Multi-instance/high-traffic hosting needs a shared store and a reviewed trusted client-identity design.
- Guest capabilities and short-lived image URLs require staff/verified-account recovery after expiry or closing the tab. Legacy guest access links require recovery; do not restore anonymous read/update routes to support them.
- Phone verification/OTP is not implemented. Guest-to-account claiming remains blocked to protect historical records. Existing duplicate phone records require a reviewed identity/data cleanup, not an automatic production merge.
- Customer token logout clears the browser cookie; password changes revoke the credential-bound token. A separately stolen customer token could remain valid for its seven-day lifetime. Shorter lifetimes or a dedicated persistent customer session model should be considered for a higher-risk deployment.
- The dashboard export is sanitized business data, not a full disaster-recovery backup. Upload filesystem writes are not transactional with MySQL and can leave orphan files after a failed request. Do not bulk-delete them without reference checks.
- Remaining lint warnings and development-tool advisories are documented above. This is an application hardening pass, not a penetration-test certification.

## References

- Express production security: https://expressjs.com/en/advanced/best-practice-security/
- OWASP password storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Next.js advisory: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j
- UUID advisory: https://github.com/advisories/GHSA-w5hq-g745-h8pq
- Development braces advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

## Copy to next developer

Work in the existing ZeroOne npm workspace. Read README.md, docs/DEPLOYMENT.md and this handover. Current code builds and passes 18 backend regression tests plus production frontend fixture checks. MySQL schema/data are unchanged. Auth cookies, credential/device-session checks, guest capability tokens, signed payment images and booking transactions are now required behavior; preserve them. Runtime audit is clean, while lint warnings and development-only advisories remain explicit. Complete staging database/email/hosting validation before release. Never expose .env values, upload customer evidence in a source handover, or run production database modifications without the owner's approval.
