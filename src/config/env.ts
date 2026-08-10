import "server-only";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z.enum(["development","test","production"]).default("development"),
  DATABASE_URL: z.string().min(1), DIRECT_URL: z.string().min(1), AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url().default("http://localhost:3001"), STOREFRONT_URL: z.string().url().default("http://localhost:3000"),
  STOREFRONT_ORIGIN: z.string().url().default("http://localhost:3000"), STOREFRONT_REVALIDATION_SECRET: z.string().optional(),
  CASHFREE_CLIENT_ID: z.string().optional(), CASHFREE_CLIENT_SECRET: z.string().optional(), CASHFREE_ENV: z.enum(["sandbox","production"]).default("sandbox"), CASHFREE_API_VERSION: z.string().default("2025-01-01"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(), CLOUDINARY_API_KEY: z.string().optional(), CLOUDINARY_API_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  EMAIL_PROVIDER: z.string().optional(), EMAIL_API_KEY: z.string().optional(), EMAIL_FROM: z.string().optional(),
  LOG_LEVEL: z.string().default("info")
});
export const env = schema.parse(process.env);
export const serviceStatus = { cashfree: Boolean(env.CASHFREE_CLIENT_ID && env.CASHFREE_CLIENT_SECRET), cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET), revalidation: Boolean(env.STOREFRONT_REVALIDATION_SECRET), google: Boolean(env.GOOGLE_CLIENT_ID), email: Boolean(env.EMAIL_API_KEY && env.EMAIL_FROM) };
