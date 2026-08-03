# Payment rules
- Cashfree redirects are never proof of payment. Verify with Cashfree or a verified webhook.
- Keep provider credentials server-only. Persist raw provider data only after redaction.
- Use database transactions, unique provider IDs, and idempotency keys for state transitions.
- Inventory and fulfilment must not be finalized twice.
