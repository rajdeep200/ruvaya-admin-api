-- Run only against a disposable PostgreSQL database after applying migrations.
-- The transaction always rolls back. Any failed invariant aborts with a non-zero psql exit.
BEGIN;

INSERT INTO "Product" ("id","slug","name","internalCode","shortDescription","fullDescription","regularPricePaise","fabric","occasions","washCare","shippingInfo","searchKeywords","updatedAt")
VALUES ('verify-product','verify-product','Verify Product','VERIFY-PRODUCT','verify','verify',10000,'Cotton',ARRAY[]::TEXT[],ARRAY[]::TEXT[],'verify',ARRAY[]::TEXT[],CURRENT_TIMESTAMP);
INSERT INTO "ProductVariant" ("id","productId","sku","color","colorLabel","size","currentStock","reservedStock")
VALUES ('verify-variant','verify-product','VERIFY-SKU','blue','Blue','M',1,0);
INSERT INTO "Customer" ("id","name","flags","updatedAt") VALUES ('verify-customer','Verify Customer',ARRAY[]::TEXT[],CURRENT_TIMESTAMP);
INSERT INTO "Order" ("id","orderNumber","customerId","subtotalPaise","totalPaise","shippingAddress","idempotencyKey","updatedAt")
VALUES ('verify-order','VERIFY-ORDER','verify-customer',10000,10000,'{}','verify-key',CURRENT_TIMESTAMP);
INSERT INTO "OrderItem" ("id","orderId","productId","variantId","productName","sku","color","size","quantity","unitPricePaise","totalPaise")
VALUES ('verify-item','verify-order','verify-product','verify-variant','Verify Product','VERIFY-SKU','Blue','M',1,10000,10000);

DO $$
DECLARE first_count INTEGER; second_count INTEGER;
BEGIN
  UPDATE "ProductVariant" SET "reservedStock"="reservedStock"+1
  WHERE "id"='verify-variant' AND "currentStock"-"reservedStock">=1;
  GET DIAGNOSTICS first_count = ROW_COUNT;
  UPDATE "ProductVariant" SET "reservedStock"="reservedStock"+1
  WHERE "id"='verify-variant' AND "currentStock"-"reservedStock">=1;
  GET DIAGNOSTICS second_count = ROW_COUNT;
  IF first_count <> 1 OR second_count <> 0 THEN RAISE EXCEPTION 'oversell guard failed: %, %', first_count, second_count; END IF;
END $$;

INSERT INTO "InventoryReservation" ("id","variantId","orderId","orderItemId","quantity","expiresAt")
VALUES ('verify-reservation','verify-variant','verify-order','verify-item',1,CURRENT_TIMESTAMP + INTERVAL '20 minutes');
UPDATE "InventoryReservation" SET "status"='CONSUMED',"consumedAt"=CURRENT_TIMESTAMP WHERE "id"='verify-reservation' AND "status"='ACTIVE';
UPDATE "ProductVariant" SET "currentStock"="currentStock"-1,"reservedStock"="reservedStock"-1
WHERE "id"='verify-variant' AND "currentStock">=1 AND "reservedStock">=1;

DO $$
DECLARE duplicate_count INTEGER;
BEGIN
  IF (SELECT "currentStock" FROM "ProductVariant" WHERE "id"='verify-variant') <> 0 OR
     (SELECT "reservedStock" FROM "ProductVariant" WHERE "id"='verify-variant') <> 0 THEN
    RAISE EXCEPTION 'consume counters failed';
  END IF;
  UPDATE "InventoryReservation" SET "status"='RELEASED' WHERE "id"='verify-reservation' AND "status"='ACTIVE';
  GET DIAGNOSTICS duplicate_count = ROW_COUNT;
  IF duplicate_count <> 0 THEN RAISE EXCEPTION 'duplicate terminal reservation transition succeeded'; END IF;
END $$;

INSERT INTO "CheckoutOperation" ("id","idempotencyKey","requestHash","providerIdempotencyKey","expiresAt","updatedAt")
VALUES ('verify-operation','same-key','same-hash','stable-provider-key',CURRENT_TIMESTAMP + INTERVAL '1 day',CURRENT_TIMESTAMP);
DO $$ BEGIN
  IF (SELECT "requestHash" FROM "CheckoutOperation" WHERE "operationType"='CHECKOUT' AND "idempotencyKey"='same-key') <> 'same-hash' THEN
    RAISE EXCEPTION 'idempotency hash lookup failed';
  END IF;
END $$;

ROLLBACK;
