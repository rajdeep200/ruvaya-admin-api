# Cashfree integration

The adapter uses Cashfree PG API version `2025-01-01`, sandbox by default. Order creation includes an API idempotency UUID. Never infer success from the return URL. Reconcile through Get Order and verified webhooks. The webhook route reads `request.text()` before parsing, signs `timestamp + rawBody` with HMAC-SHA256/client secret, Base64 compares in constant time, rejects timestamps beyond five minutes, and deduplicates provider events.

Refunds call `POST /orders/{order_id}/refunds`; stored refund totals must be checked inside a transaction before calling the provider.
