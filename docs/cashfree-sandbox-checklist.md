# Cashfree sandbox checklist

- Configure sandbox credentials, HTTPS webhook, return URL, and 2025-01-01 events.
- Exercise success, pending, failed, cancelled/user-dropped, retry, duplicate and delayed webhooks.
- Confirm invalid signatures and stale timestamps return 401.
- Confirm paid amount/currency matches and duplicate delivery changes state once.
- Reconcile missed webhooks using Get Order. Exercise full/partial/excess/duplicate refunds.
