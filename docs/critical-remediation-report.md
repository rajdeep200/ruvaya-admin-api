# Critical Remediation Report

Date: 2026-07-31. Scope: Phase A critical findings only.

## Result

The request-boundary and static storefront-contract blockers are fixed and runtime-verified. Checkout, inventory,
and payment lifecycle code now uses transaction-safe services and a forward migration, but database concurrency
scenarios are **NOT TESTED** because PostgreSQL is unreachable. Cashfree sandbox is also **NOT TESTED** because
credentials were not supplied. These areas are not operationally proven.

## Fixes

### Proxy/CORS/security

The inactive root proxy moved to `src/proxy.ts`. It grants credentialed CORS only to the exact storefront origin
on public APIs, handles approved preflight, rejects hostile admin mutations, leaves webhooks reachable, and emits
CSP, frame denial, nosniff, referrer/permissions policy and production HSTS. The build reports
`ƒ Proxy (Middleware)`. Runtime results: approved origin 503 with CORS; hostile origin 503 without CORS; approved
OPTIONS 204; hostile admin mutation 403; unsigned webhook 401 at its handler; security headers present.
`scripts/verify-proxy.ps1` reproduces the requests.

### Storefront compatibility

Media mappers include persisted IDs. Public products without HTTPS media are excluded. Demo Cloudinary fallbacks
were removed from remediated product/order/collection/campaign/search DTO paths. Seeds now publish valid config,
homepage, navigation, content versions and a collection; an owned local asset supplies the seeded CMS image.
`npm run verify:storefront-contract` parses representative DTOs with the exact sibling schemas: **20/20 PASS**.

The checkout response's legacy `orderId` field now explicitly carries an opaque payment capability. Storefront Zod
schemas require at least 32 characters and its payment client uses capability terminology internally.

### Inventory and payment lifecycle

Reservations have ACTIVE/CONSUMED/RELEASED/EXPIRED states, expiry and a unique order-item link. Reservation uses one
conditional SQL update requiring `currentStock - reservedStock >= quantity` inside a serializable transaction.
Success consumes once and decrements both counters; failure/expiry releases once and decrements reserved only.
Adjustments are recorded. Refund state never changes sellable stock. Out-of-order success atomically reacquires a
released reservation or remains reconcilable instead of overselling. A bearer-protected expiry operation is at
`POST /api/v1/operations/reservations/expire`.

Webhook and polling share `transitionPayment`. SUCCESS is terminal. Provider amount/currency are checked, attempts
are recorded, history is appended once, inventory changes once, and the winning transition queues one notification.

### Checkout and Cashfree idempotency

Checkout requires matching header/body UUIDs. Canonical business input is SHA-256 hashed. `CheckoutOperation`
stores key, hash, state, order, safe response, stable provider IDs/key, failures and expiry. Completed replay returns
the original response; changed payload returns `IDEMPOTENCY_CONFLICT`; concurrent processing returns
`IDEMPOTENCY_IN_PROGRESS` without a second checkout.

Provider ID and idempotency key persist before Cashfree invocation. Calls time out after 10 seconds. Recovery first
fetches the deterministic provider order, then retries create with the same key. ID, amount and INR currency are
verified and provider response is persisted. Create-order never marks paid.

A 256-bit random payment capability is hashed on the order and expires. Status/retry resolve only by its hash and
are database-rate-limited by capability plus client address; raw database IDs are no longer accepted by routes.

## Migration and changed files

`20260731170000_critical_remediation/migration.sql` adds enums, `CheckoutOperation`, capability fields, reservation
relations/states, stable payment metadata, indexes, foreign keys and inventory/quantity checks. It drops legacy
orphan transient reservations and backfills legacy provider idempotency from unique provider order IDs.

Changed areas: proxy; public DTO routes/mappers; checkout, inventory and payment services/routes; Cashfree timeout;
rate limiter; Prisma schema/seed/migration; verification scripts; owned placeholder asset; storefront checkout and
payment schemas/client/docs. Cosmetic admin work was not touched.

## Verification

- Prisma format, validate, generate: PASS.
- Backend TypeScript, ESLint, production build: PASS; 42 routes and active proxy.
- Storefront TypeScript, ESLint, production build: PASS.
- Exact storefront contract fixtures: PASS, 20/20.
- Runtime proxy scenarios: PASS.
- Migration apply, seed, concurrent checkout, replay/conflict, duplicate success, success-then-failure, release and
  expiry against PostgreSQL: **NOT TESTED — database unavailable**.
- Cashfree sandbox create/status/webhook/timeout recovery: **NOT TESTED — credentials unavailable**.

## Remaining critical/high risk

Inventory/payment remediation remains **NOT TESTABLE** operationally until the migration and required concurrent
scenarios run on disposable PostgreSQL. Cashfree recovery remains **PARTIALLY FIXED** until a real sandbox run.
The non-Phase-A high risks from the original audit remain intentionally out of scope.
