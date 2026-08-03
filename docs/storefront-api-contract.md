# Storefront API compatibility

Source of truth: `../ruvaya-storefront/docs/api-contract.md` and `src/lib/validation/*`.

Implemented: health, storefront config/homepage/navigation, products, collections, campaigns, search, serviceability, cart validation, idempotent checkout, payment status/retry, opaque-token order tracking/detail, reviews, analytics ingestion, newsletter, support, content pages, and Cashfree webhooks.

All responses use the storefront envelope. Internal paise converts to numeric whole-rupee DTO amounts only in `src/contracts/public/mappers.ts`. Public product DTOs omit cost, supplier, source, notes, margins, inventory counts, and internal codes.

No storefront contract changes are currently required. Runtime compatibility must still be exercised against the storefront Zod schemas after applying the migration and seeding a real PostgreSQL database.

Error codes supported: `VALIDATION_ERROR`, `AUTH_EXPIRED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PRODUCT_UNAVAILABLE`, `PRICE_CHANGED`, `PAYMENT_PENDING`, `PAYMENT_FAILED`, `NOT_CONFIGURED`, `INTERNAL_ERROR`.
