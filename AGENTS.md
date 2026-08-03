# Ruvaya Admin/API project rules

- This repository contains the private admin UI, backend APIs, and all database access.
- The storefront is a separate zero-database repository. Public APIs must match its Zod contract exactly.
- Prisma access stays in server-only modules. Route handlers remain thin.
- Store all money as integer paise. Convert to storefront whole-rupee DTOs only at the boundary.
- Verify every Cashfree success server-side. Webhook processing must verify signatures and be idempotent.
- Cloudinary API secrets stay server-side. Never expose supplier/source data in public APIs.
- Analytics must reject unnecessary PII. Sensitive mutations require redacted audit logs.
- Typecheck, lint, and production build must pass before completion.
- Do not install unit-test frameworks without explicit instruction.
