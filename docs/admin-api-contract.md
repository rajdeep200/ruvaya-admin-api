# Admin product API contract

All routes require the admin session cookie and `catalogue.write` unless identified as read-only.

## Products

- `POST /api/v1/admin/products/draft` — create the minimal draft needed before media upload.
- `POST /api/v1/admin/products` — create a complete product editor payload.
- `GET /api/v1/admin/products/:id` — editor data plus collection options (`catalogue.read`).
- `PATCH /api/v1/admin/products/:id` — allowlisted complete editor payload; transactionally upserts variants,
  inventory adjustments, measurements, collections and private sources.
- `POST /api/v1/admin/products/:id/publish|unpublish|archive|duplicate` — explicit lifecycle operations.

Publishing rejects invalid price/inventory, missing active variants, missing required attributes/shipping, and a
missing confirmed primary image. Draft data is not mutated by a failed publish validation.

## Media

- `POST /api/v1/admin/media/upload-signature` — `{productId, resourceType}`.
- `POST /api/v1/admin/media/confirm` — exact signed Cloudinary response metadata plus product context.
- `PATCH|DELETE /api/v1/admin/media/:id` — edit safe associations/alt text or perform safe provider deletion.
- `POST /api/v1/admin/media/reorder` — ownership-validated ordered IDs.
- `POST /api/v1/admin/media/:id/set-primary` — one confirmed primary image per product.

## Variants and inventory

- `POST /api/v1/admin/products/:productId/variants`
- `PATCH|DELETE /api/v1/admin/variants/:variantId` — DELETE archives; it never destroys order history.
- `POST /api/v1/admin/inventory/adjust` — atomic delta with reason and audit/inventory history.
- `GET /api/v1/admin/inventory/history?productId=&variantId=&take=` (`catalogue.read`).

All JSON inputs are Zod-validated. Cost/source fields are only returned by protected admin APIs and are never part
of public storefront mappers.
