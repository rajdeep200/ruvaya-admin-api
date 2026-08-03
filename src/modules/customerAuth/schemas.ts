import { z } from "zod";

const phoneSchema = z.string().regex(/^[6-9]\d{9}$/);
const pincodeSchema = z.string().regex(/^[1-9]\d{5}$/);

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: phoneSchema.nullable().optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

export const accountAddressInputSchema = z.object({
  label: z.string().max(40).nullable().optional(),
  fullName: z.string().min(2).max(120),
  phone: phoneSchema,
  email: z.string().email().nullable().optional(),
  addressLine: z.string().min(5).max(300),
  locality: z.string().max(100).nullable().optional(),
  landmark: z.string().max(100).nullable().optional(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: pincodeSchema,
  isDefault: z.boolean().optional(),
});

export const accountAddressUpdateSchema = accountAddressInputSchema.partial();
