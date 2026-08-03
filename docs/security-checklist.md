# Security checklist

- [x] Server-only secrets, strict validation, hashed sessions/reset tokens, Argon2id, central RBAC
- [x] Raw-body Cashfree verification, replay protection, idempotency constraints, audit redaction
- [x] Secure headers and opaque-token schema
- [ ] CSRF token for browser mutations, distributed rate limiting, full CORS allowlist middleware
- [ ] Rich-text sanitizer, upload MIME sniffing, CSP rollout, CSV formula neutralisation
- [ ] Dependency audit, permission/IDOR manual tests, secret scan and production penetration review
