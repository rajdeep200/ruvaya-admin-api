# Ruvaya Admin/API

Private Ruvaya operations dashboard and the only database/provider backend for the separate storefront.

## Local setup

1. Install Node 20.9+ and run `npm install`.
2. Copy `.env.example` to `.env.local`; set PostgreSQL URLs, a 32+ character `AUTH_SECRET`, and a 12+ character temporary seed password.
3. Run `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:seed`, then `npm run dev`.
4. Admin is at `/admin`; APIs are under `/api/v1`.

Provider credentials are optional for build but real Cashfree/Cloudinary operations return `NOT_CONFIGURED` until set. No integration is faked. The application includes the public storefront contract, authenticated catalogue/CMS/order/customer/review/payment/refund/settings/audit APIs, safe exports, analytics ingestion/reporting, Cloudinary signing, Cashfree webhooks and inventory reservations. Verify with `npm run verify`. See `docs/implementation-plan.md`, contracts, deployment, security, QA and operational runbook.

Product creation and editing share the structured editor at `/admin/products/new` and
`/admin/products/{id}/edit`. Media uploads directly to Cloudinary using server-generated signatures and is accepted
only after server-side response/provider verification. Apply all Prisma migrations before using the editor. See
`docs/cloudinary-media-flow.md`, `docs/admin-api-contract.md`, and `docs/product-management-manual-qa.md`.
