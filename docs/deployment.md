# Deployment

Provision external PostgreSQL with pooled `DATABASE_URL` and direct `DIRECT_URL`. Configure all `.env.example` values in Vercel, run `npm run prisma:deploy`, then `npm run prisma:seed` once with a strong temporary seed password and remove it. Deploy, confirm `/api/v1/health`, rotate seed credentials, configure Cashfree/Cloudinary/webhooks, and point storefront `NEXT_PUBLIC_API_BASE_URL` to `https://admin.ruvaya.in/api/v1`. Never prefix server secrets with `NEXT_PUBLIC_`.
