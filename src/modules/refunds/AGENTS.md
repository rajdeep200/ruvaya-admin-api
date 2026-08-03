# Refund rules
- Validate refund totals in integer paise and prevent cumulative over-refunds.
- Initiation requires permission, reason, audit log, and a unique idempotency key.
- Provider acknowledgement is not completion; reconcile terminal status server-side.
