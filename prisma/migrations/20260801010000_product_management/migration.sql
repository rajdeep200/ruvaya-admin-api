CREATE TYPE "MediaUploadStatus" AS ENUM ('CONFIRMED', 'DELETE_PENDING', 'ORPHANED', 'ARCHIVED');

ALTER TABLE "Product"
  ADD COLUMN "taxInclusive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "fitIndicator" TEXT,
  ADD COLUMN "fitNote" TEXT,
  ADD COLUMN "countryOfOrigin" TEXT,
  ADD COLUMN "packageContents" TEXT,
  ADD COLUMN "dispatchDays" INTEGER,
  ADD COLUMN "weightGrams" INTEGER,
  ADD COLUMN "cancellationEligible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "codAvailableOverride" BOOLEAN,
  ADD COLUMN "searchVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "indexable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sortPriority" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProductMedia"
  ADD COLUMN "resourceType" TEXT NOT NULL DEFAULT 'image',
  ADD COLUMN "format" TEXT,
  ADD COLUMN "version" INTEGER,
  ADD COLUMN "folder" TEXT,
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "color" TEXT,
  ADD COLUMN "assignedVariantId" TEXT,
  ADD COLUMN "uploadStatus" "MediaUploadStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "createdByAdminId" TEXT,
  ADD COLUMN "orphanReason" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ProductMedia"
SET "format" = COALESCE(NULLIF(split_part("secureUrl", '.', -1), ''), 'jpg'),
    "version" = 1,
    "folder" = regexp_replace("cloudinaryPublicId", '/[^/]+$', ''),
    "createdByAdminId" = 'legacy-migration';
ALTER TABLE "ProductMedia" ALTER COLUMN "format" SET NOT NULL;
ALTER TABLE "ProductMedia" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE "ProductMedia" ALTER COLUMN "folder" SET NOT NULL;
ALTER TABLE "ProductMedia" ALTER COLUMN "createdByAdminId" SET NOT NULL;

WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "productId" ORDER BY "position", "createdAt") AS rank
  FROM "ProductMedia" WHERE "deletedAt" IS NULL
)
UPDATE "ProductMedia" media SET "isPrimary" = (ranked.rank = 1) FROM ranked WHERE media."id" = ranked."id";

ALTER TABLE "ProductMeasurement" ADD COLUMN "shoulderTenthsIn" INTEGER;
ALTER TABLE "ProductSource"
  ADD COLUMN "platform" TEXT,
  ADD COLUMN "sourceListingId" TEXT,
  ADD COLUMN "variantMapping" JSONB,
  ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
  ADD COLUMN "availabilityState" TEXT,
  ADD COLUMN "expectedDeliveryDays" INTEGER,
  ADD COLUMN "backupSource" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryAdjustment" ADD COLUMN "previousStock" INTEGER, ADD COLUMN "newStock" INTEGER;

CREATE INDEX "ProductMedia_assignedVariantId_idx" ON "ProductMedia"("assignedVariantId");
CREATE INDEX "ProductMedia_uploadStatus_deletedAt_idx" ON "ProductMedia"("uploadStatus", "deletedAt");
CREATE UNIQUE INDEX "ProductMedia_one_primary_per_product" ON "ProductMedia"("productId") WHERE "isPrimary" = true AND "deletedAt" IS NULL;
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_assignedVariantId_fkey" FOREIGN KEY ("assignedVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_nonnegative_shipping" CHECK (("dispatchDays" IS NULL OR "dispatchDays" >= 0) AND ("weightGrams" IS NULL OR "weightGrams" > 0));
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_valid_metadata" CHECK ("version" > 0 AND ("bytes" IS NULL OR "bytes" > 0) AND ("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0));
