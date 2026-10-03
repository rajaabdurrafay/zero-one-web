# Verification — 3 October 2026

## Before Phase 2

Branch optimize-finalize was created after showing initial git status. Existing pending work was preserved in three logical commits: daba508 (auth/dependency fixes), 87aca0a (prior asset/template removals), 402d935 (baseline tests/docs). Fresh baseline: backend + website + admin build PASS; all three TypeScript checks PASS; 18 database-free tests PASS. No implementation changes preceded this baseline.

## Final checks

| Check | Result |
| --- | --- |
| Backend production build and Prisma client generation | PASS |
| Website production build | PASS |
| Admin production build | PASS |
| Type-check across backend, website, admin and shared | PASS |
| Database-free unit/security tests | 26 PASS |
| Local isolated database integration tests | 15 PASS |
| Frontend production-handler fixture smoke tests | PASS |
| Admin lint | 0 errors, 174 warnings |
| Website lint | 0 errors, 55 warnings |
| Production dependency audit | 0 vulnerabilities |
| Git diff whitespace check | PASS |

Local integration database: MariaDB 11.4.11, loopback port 33079, zeroone_test_finalize. No production connection or migration. Expected duplicate-signup unique-constraint rejection is logged and asserted as HTTP 409. Test fixture records are retained; no database reset/delete. The test runner requires an explicit local TEST_DATABASE_URL with zeroone_test_* name and disables external email/geolocation. Added CI MySQL 8 service has not run remotely because this branch has not been pushed.

Integration coverage: anonymous account-link protection; simultaneous booking overlap/adjacency; extension conflict rollback; walk-in availability and concurrent/idempotent stop; reschedule rate snapshot, discounts, add-ons/group totals; paused count-up billing; canonical signup races/logout revocation; reset expiry/replay/guest protection; v1 pagination/input validation; per-device attendance/Karachi midnight; group payment allocation/history; staff verified guest claims; content validation/non-destructive archive; successful tier extension; concurrent resume/stop cannot reopen closed session.

Frontend fixture checks: HttpOnly secure cookies, credential relay, CSRF rejection, forged admin session rejection, configured backend SSR theme, customer backend logout revocation, failed logout retaining cookie for retry, protected revalidation and security headers. Fixture checks exercise built handlers and do not contact the configured real API/database. They are not a full visual/browser user journey test.

Lint warnings remain visible as requested; no mass warning cleanup or downgrade was performed. Release still requires an approved existing-schema transition, actual MySQL staging rehearsal, email delivery and hosting/backup checks. Runtime audit result is not a penetration-test certification. No push or deployment was performed.
