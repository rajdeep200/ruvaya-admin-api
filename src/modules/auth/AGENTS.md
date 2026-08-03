# Authentication rules
- Hash passwords with Argon2id. Store only hashed session/reset tokens.
- Enforce permissions server-side on every private operation; UI hiding is not authorization.
- Use HTTP-only, Secure-in-production, SameSite=Lax cookies and revocable expiring sessions.
- Rate-limit and audit login and password reset activity without logging credentials or raw tokens.
