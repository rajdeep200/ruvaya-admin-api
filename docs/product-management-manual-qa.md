# Product management manual QA

Use a disposable migrated PostgreSQL database and a non-production Cloudinary folder/account. Record IDs and
screenshots for failures. Never mark the provider section passed without observing Cloudinary and PostgreSQL.

## Product creation and lifecycle

- [ ] Create a simple no-size/no-colour draft; confirm one hidden base variant and retained form values.
- [ ] Create size-only, colour-only, and size×colour products; verify generated unique SKUs and independent stock.
- [ ] Save a draft, reload the edit URL, and verify every section persists.
- [ ] Publish a ready product; verify primary image, active variant and valid-price requirements.
- [ ] Attempt invalid publish; verify checklist/error and no lost draft data.
- [ ] Unpublish, archive and duplicate; verify archive/history safety and duplicate stock starts at zero.
- [ ] Trigger duplicate slug, internal code and SKU errors; verify inline/summary errors and preserved inputs.

## Media

- [ ] Upload one image and multiple images by picker and drag/drop; observe progress and previews.
- [ ] Cancel an upload; retry a failed upload.
- [ ] Reject oversized and unsupported files in the browser and backend confirmation.
- [ ] Verify provider-not-configured error is actionable.
- [ ] Reorder by drag/drop, reload, and verify order.
- [ ] Set primary; verify exactly one primary after reload and in public list/detail DTOs.
- [ ] Edit alt text; assign product/colour/variant media and verify colour detail images.
- [ ] Replace: confirm new asset/database row before old Cloudinary deletion.
- [ ] Delete non-primary and primary-with-replacement media; verify Cloudinary and soft-deleted DB state.
- [ ] Reject deletion of the last published image.
- [ ] Simulate Cloudinary delete failure and DB cleanup failure; verify CONFIRMED rollback or DELETE_PENDING state.
- [ ] Inspect and clean orphan/reconciliation records; confirm audit logs contain no secrets.

## Variants and inventory

- [ ] Add/remove standard and custom sizes; add/remove colours; verify existing matrix cells retain values.
- [ ] Warn operationally before removing a dimension with stock/references; verify rows are deactivated, not deleted.
- [ ] Reject duplicate SKU and duplicate product/colour/size.
- [ ] Set zero stock and deactivate a variant; verify public availability.
- [ ] Verify opening stock creates InventoryAdjustment with previous/new/delta.
- [ ] Perform manual positive/negative adjustment; reject negative or below-reserved stock.
- [ ] Confirm current, reserved and available stock remain consistent with checkout reservations.

## Pricing, attributes and privacy

- [ ] Enter whole and decimal rupees; verify exact paise in PostgreSQL.
- [ ] Test regular/sale/cost values and reject sale above regular or negative amounts.
- [ ] Verify live discount/margin summary; confirm cost never appears in public JSON.
- [ ] Exercise fabric/fit/pattern/occasion/sleeve/neck and Other options.
- [ ] Add per-size measurements and verify tenths-of-inch persistence.
- [ ] Select draft/published collections loaded from the database.
- [ ] Verify SEO warnings do not block draft save.
- [ ] Verify shipping/default overrides, return/cancellation and COD override.
- [ ] Add MEESHO/backup sources; inspect product list/detail, search, campaign, collection, tracking and analytics to
  confirm source URLs, cost, notes and admin IDs never appear.

## Storefront

- [ ] Run `npm run verify:storefront-contract`.
- [ ] Parse product list/detail, collection/campaign products and search results.
- [ ] Verify required media ID, primary image, colour images and size availability.
- [ ] Confirm no private source, cost, inventory history, Cloudinary secret or admin fields leak.
