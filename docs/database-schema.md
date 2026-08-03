# Database schema

`prisma/schema.prisma` is the authoritative PostgreSQL model. Money is integer paise and timestamps are UTC.

Product management uses the existing `Product`, `ProductVariant`, `ProductMedia`, `ProductMeasurement`,
`CollectionProduct`, `ProductSource` and `InventoryAdjustment` models. Migration
`20260801010000_product_management` extends them instead of creating an overlapping media/catalogue system.

- Product contains customer attributes, merchandising, SEO/search visibility, dispatch/returns and lifecycle.
- Variant is the stock authority for every size/colour combination. Historical variants are deactivated, not
  deleted. Database checks preserve non-negative `currentStock`, `reservedStock <= currentStock`, and quantities.
- ProductMedia stores verified Cloudinary identity, folder, version, format, dimensions, bytes, status, primary
  flag, ordering, alt text and optional colour/variant association. A partial unique index permits one live primary
  image per product.
- Measurements use tenths of an inch, including bust, waist, hip, shoulder, sleeve and length.
- InventoryAdjustment records previous/new stock, delta, reason, administrator and timestamp.
- ProductSource stores private platform/supplier/listing/mapping/cost/availability data. No public relation mapper
  includes it.

Financial/order relations remain restrictive; owned draft children cascade only where historical commerce data is
not at risk.
