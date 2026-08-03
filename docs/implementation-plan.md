# Implementation plan and progress

## Repository state and contract findings

The repository started empty. The sibling storefront is Next.js 16.2 and validates every API response with Zod. Its contract requires `{success:true,data}` / `{success:false,error}` envelopes, rupee-denominated public money DTOs, opaque order tokens, server-authoritative cart totals, idempotent checkout, and Cashfree-verified payment state. Supplier, cost, and source fields are private.

## Decisions

- Next.js App Router provides the admin UI and versioned APIs; services contain business logic.
- PostgreSQL/Prisma is the only source of truth. Integer paise is authoritative.
- Database-backed sessions use Argon2id, hashed opaque cookies, revocation, permissions, and audit logs.
- Cashfree uses direct 2025-01-01 REST calls. Webhooks are verified over timestamp + untouched raw body, replay-window checked, and deduplicated by provider event ID.
- Cloudinary assets store immutable public IDs and secure delivery URLs; signing remains server-only.
- Versioned JSON documents are used for constrained homepage/navigation/config CMS publishing.

## Phases

- [x] Foundation, environment validation, schema, shared HTTP/money/security utilities
- [x] Authentication service, RBAC model, admin shell, audit foundation
- [x] Product persistence, public DTO mapper, public/admin product endpoints
- [x] Cashfree adapter and idempotent webhook processing
- [x] Catalogue creation, collection/campaign administration, inventory adjustments and admin APIs
- [x] Versioned CMS draft/publish and failure-tolerant storefront revalidation
- [x] Cart validation, serializable inventory reservation, checkout and opaque order tracking
- [x] Cashfree payment status/retry, verified webhook and refund initiation
- [x] Analytics ingestion/reporting, customer/order/payment/refund dashboards and safe CSV exports
- [ ] Credential-backed PostgreSQL, Cashfree, Cloudinary and email-provider QA

## Risks and dependencies

Real completion depends on PostgreSQL, Cashfree sandbox, Cloudinary, email provider, and storefront revalidation credentials. Provider flows must never be reported as verified without them. Serverless concurrent inventory reservations and webhook delivery are the highest consistency risks; use serializable transactions, unique constraints, and reconciliation.
