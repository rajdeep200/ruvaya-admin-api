# Product management remediation report

Date: 2026-08-01.

## Existing problems

The former form was an unstructured create-only page that accepted arbitrary Cloudinary public IDs and URLs,
converted rupees with floating-point multiplication, created only one variant, had no edit page, and could not
manage media, measurements, collections, inventory history, SEO, shipping or private sourcing.

## Architecture and implementation

The existing product/media models were extended. The editor creates a minimal draft before upload, then uses the
same `ProductEditor` for create and edit. Product save transactionally upserts the matrix, deactivates removed
historical variants, records stock changes, replaces measurements/collections, and maintains private sources.

Cloudinary is a signed direct-browser flow with XHR progress. Confirmation verifies the response signature and
fetches the provider resource before persisting. Media supports multiple files, preview, cancel/retry, native
drag/drop ordering, primary selection, alt text, colour/variant association, replacement and safe deletion.

The responsive card-based editor covers basic identity, media, four variant modes, paise-safe pricing/inventory,
attributes, size/fit measurements, merchandising/collections, SEO, shipping/returns, private sources and readiness.

## Security

Every API requires catalogue permission, Zod input allowlists and service ownership checks. Folders are fixed to
the product, arbitrary remote URLs are rejected, provider metadata is compared server-side, the API secret is never
returned, variants/media are IDOR-checked, and sensitive operations are audited. Public mappers do not include
cost, sources, adjustment history, admin IDs or secrets.

## Prisma and API changes

Migration `20260801010000_product_management` adds product operational fields, verified media metadata/status and
associations, shoulder measurements, source operations fields, inventory before/after values, constraints and the
one-primary index. See `admin-api-contract.md` for routes.

## Verification and limitations

Prisma format and validation passed. The generated Prisma client typechecked successfully; a later regeneration
attempt was blocked by the Windows development server holding Prisma's query-engine DLL open. TypeScript, ESLint,
the production Next.js build (47 pages), and the 20-case storefront contract verification all passed.

The local PostgreSQL database at `localhost:5433` was reachable and migration
`20260801010000_product_management` was successfully deployed. A real Cloudinary provider smoke test also passed:
a temporary 1x1 PNG was uploaded to the product folder namespace, retrieved through the Admin API with verified
metadata, and immediately destroyed (`cleanup: ok`). Browser-level manual scenarios remain documented in the QA
checklist; no mock result is presented as provider verification.

The form uses native HTML drag/drop rather than an added dependency. Dimension removal safely deactivates missing
variants; the manual QA checklist requires an operator to confirm referenced-stock warnings and history behavior.
