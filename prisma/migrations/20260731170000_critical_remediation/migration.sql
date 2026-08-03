CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');
CREATE TYPE "CheckoutOperationState" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "Order"
  ADD COLUMN "paymentCapabilityHash" TEXT,
  ADD COLUMN "paymentCapabilityExpiresAt" TIMESTAMP(3);

ALTER TABLE "InventoryReservation"
  ADD COLUMN "orderItemId" TEXT,
  ADD COLUMN "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE';

-- Legacy reservations are transient. Orphans cannot participate safely in the new lifecycle.
DELETE FROM "InventoryReservation" WHERE "orderId" IS NULL;
UPDATE "InventoryReservation" r
SET "orderItemId" = (
  SELECT oi."id"
  FROM "OrderItem" oi
  WHERE oi."orderId" = r."orderId" AND oi."variantId" = r."variantId"
  ORDER BY oi."id"
  LIMIT 1
);
DELETE FROM "InventoryReservation" WHERE "orderItemId" IS NULL;
ALTER TABLE "InventoryReservation" ALTER COLUMN "orderId" SET NOT NULL;
ALTER TABLE "InventoryReservation" ALTER COLUMN "orderItemId" SET NOT NULL;

ALTER TABLE "Payment"
  ADD COLUMN "providerIdempotencyKey" TEXT,
  ADD COLUMN "paymentSessionId" TEXT,
  ADD COLUMN "providerResponse" JSONB;
UPDATE "Payment" SET "providerIdempotencyKey" = "providerOrderId" || ':legacy' WHERE "providerIdempotencyKey" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "providerIdempotencyKey" SET NOT NULL;

CREATE TABLE "CheckoutOperation" (
  "id" TEXT NOT NULL,
  "operationType" TEXT NOT NULL DEFAULT 'CHECKOUT',
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "state" "CheckoutOperationState" NOT NULL DEFAULT 'PROCESSING',
  "orderId" TEXT,
  "safeResponse" JSONB,
  "providerOrderId" TEXT,
  "providerIdempotencyKey" TEXT NOT NULL,
  "paymentCapability" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_paymentCapabilityHash_key" ON "Order"("paymentCapabilityHash");
CREATE UNIQUE INDEX "InventoryReservation_orderItemId_key" ON "InventoryReservation"("orderItemId");
CREATE UNIQUE INDEX "Payment_providerIdempotencyKey_key" ON "Payment"("providerIdempotencyKey");
CREATE UNIQUE INDEX "CheckoutOperation_orderId_key" ON "CheckoutOperation"("orderId");
CREATE UNIQUE INDEX "CheckoutOperation_providerOrderId_key" ON "CheckoutOperation"("providerOrderId");
CREATE UNIQUE INDEX "CheckoutOperation_providerIdempotencyKey_key" ON "CheckoutOperation"("providerIdempotencyKey");
CREATE UNIQUE INDEX "CheckoutOperation_operationType_idempotencyKey_key" ON "CheckoutOperation"("operationType", "idempotencyKey");
CREATE INDEX "CheckoutOperation_state_expiresAt_idx" ON "CheckoutOperation"("state", "expiresAt");

ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutOperation" ADD CONSTRAINT "CheckoutOperation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_inventory_nonnegative" CHECK ("currentStock" >= 0 AND "reservedStock" >= 0 AND "reservedStock" <= "currentStock");
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
