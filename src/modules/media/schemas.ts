import { z } from "zod";

export const uploadSignatureSchema = z.object({ productId: z.string(), resourceType: z.enum(["image", "video"]).default("image") });
export const cloudinaryConfirmationSchema = z.object({
  productId: z.string(), publicId: z.string().min(3).max(255), secureUrl: z.string().url().startsWith("https://res.cloudinary.com/"), version: z.number().int().positive(), signature: z.string().regex(/^[a-f0-9]{40,64}$/i),
  resourceType: z.enum(["image", "video"]), format: z.string().regex(/^[a-z0-9]+$/i), width: z.number().int().positive(), height: z.number().int().positive(), bytes: z.number().int().positive().max(25 * 1024 * 1024),
  folder: z.string(), altText: z.string().trim().max(300).default(""), color: z.string().trim().max(80).nullable().optional(), variantId: z.string().nullable().optional(), mimeType: z.string().max(100).nullable().optional(),
});
export const mediaPatchSchema = z.object({ altText: z.string().trim().max(300).optional(), color: z.string().trim().max(80).nullable().optional(), variantId: z.string().nullable().optional() });
export const mediaReorderSchema = z.object({ productId: z.string(), mediaIds: z.array(z.string()).min(1).max(100) });
