# Operational runbook

For payment incidents, inspect order/payment/attempt/webhook records by provider order ID, use Cashfree Get Order, then run idempotent reconciliation. Never manually mark paid without provider proof. For failed revalidation, retry after confirming the admin save succeeded. For media deletion, retain the DB record until Cloudinary confirms deletion. Back up PostgreSQL daily with point-in-time recovery; test restore quarterly. Rotate auth/encryption/provider keys one at a time, revoke sessions after auth-key incidents, and record every intervention in audit logs.
