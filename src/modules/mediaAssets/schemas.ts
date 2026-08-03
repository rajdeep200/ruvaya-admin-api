import { z } from "zod";

export const assetUploadSignatureSchema = z.object({
  resourceType: z.enum(["image", "video"]).default("image"),
});

export const assetConfirmationSchema = z.object({
  publicId: z.string().min(3).max(255),
  secureUrl: z.string().url().startsWith("https://res.cloudinary.com/"),
  version: z.number().int().positive(),
  signature: z.string().regex(/^[a-f0-9]{40,64}$/i),
  resourceType: z.enum(["image", "video"]),
  format: z.string().regex(/^[a-z0-9]+$/i),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive().max(25 * 1024 * 1024),
  folder: z.string(),
  altText: z.string().trim().max(300).default(""),
});
