# API contract

Legacy /api routes remain compatible with current clients. New mobile integrations should use /api/v1 with the same resource paths, methods and authentication. v1 rewrites to the same validated handlers; no business logic is duplicated.

Successful JSON: { "success": true, "data": ... }. Paginated responses add meta.pagination with total, page, limit and totalPages. Errors retain their HTTP status and use { "success": false, "error": { "code": "CONFLICT", "message": "..." } }. Common codes: VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, REQUEST_FAILED.

Example: GET /api/v1/bookings?page=1&limit=50 with a staff Authorization: Bearer token. Page starts at 1, limit defaults to 50 and is bounded at 100. Bookings, customers, attendance, messages and audit lists support pagination. Legacy lists without page/limit retain older response behavior and may be unbounded. Session history is bounded separately. Not every catalog/report is paginated; consult its endpoint before assuming meta.pagination.

Customer account endpoints: POST /api/v1/auth/signup, login, forgot-password, reset-password, logout; GET /api/v1/auth/me and /api/v1/bookings/my-bookings. Mobile clients keep bearer tokens in platform secure storage. Web clients use same-origin HttpOnly cookie relays. Logout revokes all current customer tokens through authVersion. Rate limits and authentication remain active on v1.

Guest booking creation returns a scoped, expiring capability; retain it securely and send it with subsequent booking/payment/receipt requests using the existing accessToken mechanism. A phone number alone grants no access. Staff may claim verified guest history through POST /api/v1/admin/customers/:guestId/claim-bookings with accountId and verificationNote (10+ characters); registered identity and normalized phone must match. Only managers/super-admins can claim; an audit record is written.

Dates representing instants use ISO-8601 with an offset. Business date queries use YYYY-MM-DD in Asia/Karachi; invalid dates are rejected. Booking/session prices are server-authoritative. Clients may preview via @zeroone/domain but cannot override the stored snapshot.

PDF, Excel, images and other streamed endpoints retain their binary content, not a JSON envelope. HTTP cache headers remain private/no-store; a short bounded in-process cache applies only to selected public catalog JSON routes. Private auth, booking and payment data never enter it.

There is no OTP, refresh-token endpoint, OpenAPI-generated SDK or dedicated mobile application in this change. Shared process-external rate limiting/cache is still needed before a multi-instance deployment.
