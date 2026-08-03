# Cloudinary product-media flow

Product media uses a persisted-draft-first design. The editor creates a minimal real product draft after basic
identity is complete and before the first upload. Uploads therefore use the fixed folder
`ruvaya/products/{productId}` and are ownership-checkable immediately; the browser cannot select a folder.

1. The authenticated editor validates JPEG, PNG, WebP, AVIF, MP4 or WebM and a 25 MB maximum.
2. `POST /api/v1/admin/media/upload-signature` validates the product and returns a short-lived signature for the
   fixed folder, resource type, `overwrite=false`, random naming and unique filenames.
3. The browser uploads directly to Cloudinary with `XMLHttpRequest`, displaying per-file progress and supporting
   cancellation/retry.
4. It submits the response to `POST /api/v1/admin/media/confirm`.
5. The backend verifies the Cloudinary response signature (`public_id` + `version`), folder/public-ID prefix,
   resource type, format and size limits. It queries Cloudinary's Admin API and compares public ID, version,
   resource type, format, byte count, dimensions, folder and secure URL before persisting `ProductMedia`.

The API secret never reaches the browser. Public IDs and URLs are not editable fields. Persisted media supports
primary selection, position, alt text, colour and variant assignment, soft deletion and reconciliation status.

Deletion marks the row `DELETE_PENDING` before calling Cloudinary. Provider failure restores `CONFIRMED` and logs
the error. Provider success followed by database failure leaves `DELETE_PENDING` for reconciliation. A published
product cannot lose its last usable image. Replacement uploads and confirms the new asset before deleting the old.

Actual provider verification requires configured `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and
`CLOUDINARY_API_SECRET`. Static checks do not prove a real upload or deletion.
