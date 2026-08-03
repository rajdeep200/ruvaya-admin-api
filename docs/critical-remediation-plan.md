# Critical Remediation Plan

Date: 2026-07-31. Scope is limited to the four Phase A critical findings in `implementation-audit.md`.

## 1. Request boundary controls

- Move the Next.js 16 proxy beside `src/app` as `src/proxy.ts`, retain a root-wide matcher, and emit a request ID plus security headers on every matched response.
- Grant credentialed CORS only to the exact normalized `STOREFRONT_ORIGIN` and only for public `/api/v1` routes. Preflight requests from any other origin receive no CORS grant. Admin APIs never receive storefront CORS.
- Reject cross-origin cookie-authenticated admin mutations by comparing `Origin` with `APP_URL`; keep Cashfree webhooks outside browser-origin enforcement.
- Verify approved, unknown, preflight, hostile-admin, webhook, and security-header behavior against a production build.

## 2. Storefront contract boundary

- Treat the sibling storefront Zod schemas as the source of truth. Copy them only into a verification-only script so runtime API code does not depend on another deployable repository.
- Correct media mapping to include persisted media IDs and remove demo Cloudinary URLs. Published products without usable media are excluded from lists and return not-found from detail APIs.
- Seed valid published storefront config, homepage, navigation, content versions, and collections.
- Add `npm run verify:storefront-contract`, parsing representative DTO fixtures for every required public endpoint with the exact storefront schemas.
- Change the checkout/payment public identifier from a database order ID to an opaque payment capability. Update both backend responses and storefront schemas/client/mock behavior explicitly.

## 3. Transactional inventory lifecycle

- Add explicit reservation status and timestamps, a unique order-item reservation link, and database checks for positive quantities and non-negative inventory.
- Reserve with one conditional PostgreSQL update: increment `reservedStock` only where `currentStock - reservedStock >= quantity`, inside a serializable transaction.
- Centralize terminal payment transitions. SUCCESS atomically consumes ACTIVE reservations, decrements both stock counters, records adjustments, advances payment/order once, and never regresses.
- Failure/cancellation/expiry atomically releases ACTIVE reservations and decrements only `reservedStock`. Replays are no-ops.
- Add a protected operational expiry endpoint callable with `AUTH_SECRET` bearer authorization; the same service is reusable by reconciliation and manual operations.
- Keep refund state independent of physical return/restock state.

## 4. Checkout and Cashfree idempotency

- Add a checkout-operation table keyed by operation and idempotency key, with canonical SHA-256 request hash, PROCESSING/COMPLETED/FAILED state, safe response, expiry, provider identifiers, and failure details.
- Require matching header/body UUIDs. Same key/different hash returns `IDEMPOTENCY_CONFLICT`; completed replay returns its stored response; in-progress returns HTTP 409 without rerunning checkout.
- Generate and persist the provider order ID and stable Cashfree idempotency key before the network call. Use a bounded request timeout and reconcile ambiguous failures through Cashfree GET before retrying creation.
- Add hashed, random, expiring payment capabilities and resolve status/retry only through them. Rate-limit both endpoints by capability and client address.
- Make webhook and status polling invoke one allowlisted transition service with amount/currency checks, attempt persistence, exactly-once history/inventory effects, and notification outbox recording.

## 5. Database and verification

- Generate a forward Prisma migration containing new enums/tables/columns/indexes/check constraints and safe backfill behavior.
- Run Prisma format/validate/generate, typecheck, lint, production builds for both repositories, contract verification, and runtime proxy smoke checks.
- A database scenario script will cover concurrent limited-stock checkout, replay/conflict, duplicate success, success-then-failure, failure release, and expiry. If PostgreSQL remains unavailable, the script will be delivered but its execution recorded as NOT TESTED.
