# Architecture

Storefront and administrators call versioned Next.js route handlers. Handlers authenticate, validate, invoke server-only domain services, map DTOs, and return uniform envelopes. Services use a reused Prisma client and PostgreSQL transactions. Cloudinary, Cashfree, email, and storefront revalidation are adapters behind server-only boundaries. Server Components may call services directly for admin reads.
