import { z } from "zod";

const optionalText = z.string().trim().max(500).optional().nullable();
const paise = z.number().int().nonnegative();
const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(160), slug, internalCode: z.string().trim().min(2).max(80),
  shortDescription: z.string().trim().min(1).max(500), fullDescription: z.string().trim().min(1).max(20_000),
  category: z.enum(["Kurti", "Kurti Set", "Co-ord Set", "Dupatta Set"]), active: z.boolean().default(true),
  regularPricePaise: paise, salePricePaise: paise.nullable().optional(), costPricePaise: paise.nullable().optional(), taxInclusive: z.boolean().default(true),
  fabric: z.string().trim().min(1).max(100), fit: optionalText, pattern: optionalText, occasions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  primaryColor: optionalText, neckType: optionalText, sleeveType: optionalText, kurtiLength: optionalText, transparency: optionalText, lining: optionalText, sideSlit: optionalText,
  washCare: z.array(z.string().trim().min(1).max(160)).max(20).default([]), modelHeightCm: z.number().int().positive().max(250).nullable().optional(), modelSizeWorn: optionalText,
  fitIndicator: optionalText, fitNote: optionalText, countryOfOrigin: optionalText, packageContents: optionalText,
  featured: z.boolean().default(false), bestseller: z.boolean().default(false), newArrival: z.boolean().default(false), badge: optionalText,
  sortPriority: z.number().int().default(0), publishStartAt: z.string().datetime().nullable().optional(), publishEndAt: z.string().datetime().nullable().optional(),
  seoTitle: optionalText, seoDescription: optionalText, searchKeywords: z.array(z.string().trim().min(1).max(80)).max(50).default([]), searchVisible: z.boolean().default(true), indexable: z.boolean().default(true),
  shippingInfo: z.string().trim().min(1).max(1000), dispatchDays: z.number().int().nonnegative().max(90).nullable().optional(), weightGrams: z.number().int().positive().max(100_000).nullable().optional(),
  returnEligible: z.boolean().default(true), returnWindowDays: z.number().int().nonnegative().max(365).nullable().optional(), cancellationEligible: z.boolean().default(true), codAvailableOverride: z.boolean().nullable().optional(),
}).superRefine((value, context) => {
  if (value.salePricePaise != null && value.salePricePaise > value.regularPricePaise) context.addIssue({ code: "custom", path: ["salePricePaise"], message: "Sale price cannot exceed regular price" });
  if (value.publishStartAt && value.publishEndAt && value.publishEndAt <= value.publishStartAt) context.addIssue({ code: "custom", path: ["publishEndAt"], message: "Unpublish date must be after publish date" });
});

export const variantInputSchema = z.object({
  id: z.string().optional(), sku: z.string().trim().min(2).max(100), color: z.string().trim().min(1).max(80), colorLabel: z.string().trim().min(1).max(80),
  colorHex: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(), size: z.string().trim().min(1).max(40), position: z.number().int().nonnegative().default(0),
  regularPricePaise: paise.nullable().optional(), salePricePaise: paise.nullable().optional(), costPricePaise: paise.nullable().optional(), openingStock: z.number().int().nonnegative().max(1_000_000).default(0),
  lowStockThreshold: z.number().int().nonnegative().default(3), active: z.boolean().default(true), weightGrams: z.number().int().positive().nullable().optional(), mediaId: z.string().nullable().optional(),
}).superRefine((value, context) => { if (value.salePricePaise != null && value.regularPricePaise != null && value.salePricePaise > value.regularPricePaise) context.addIssue({ code: "custom", path: ["salePricePaise"], message: "Variant sale price cannot exceed regular price" }); });

export const measurementInputSchema = z.object({
  size: z.string().trim().min(1).max(40), bustTenthsIn: z.number().int().positive(), waistTenthsIn: z.number().int().positive(), hipTenthsIn: z.number().int().positive(),
  shoulderTenthsIn: z.number().int().positive().nullable().optional(), lengthTenthsIn: z.number().int().positive(), sleeveTenthsIn: z.number().int().positive().nullable().optional(),
});

export const sourceInputSchema = z.object({
  id: z.string().optional(), platform: optionalText, supplierName: z.string().trim().min(1).max(160), supplierUrl: z.string().url().nullable().optional(), sourceListingId: optionalText,
  sourceSku: optionalText, variantMapping: z.record(z.string(), z.string()).nullable().optional(), sourcePricePaise: paise.nullable().optional(), lastCheckedAt: z.string().datetime().nullable().optional(),
  availabilityState: optionalText, expectedDeliveryDays: z.number().int().nonnegative().max(365).nullable().optional(), notes: z.string().max(5000).nullable().optional(), backupSource: z.boolean().default(false), active: z.boolean().default(true),
});

export const productEditorSchema = productInputSchema.extend({
  variants: z.array(variantInputSchema).min(1).max(500), measurements: z.array(measurementInputSchema).max(100).default([]), collectionIds: z.array(z.string()).max(100).default([]), sources: z.array(sourceInputSchema).max(20).default([]),
});

export const productDraftSchema = z.object({
  name: z.string().trim().min(2).max(160), slug, internalCode: z.string().trim().min(2).max(80), category: z.enum(["Kurti", "Kurti Set", "Co-ord Set", "Dupatta Set"]).default("Kurti"),
});

export const adminProductCreateSchema = productEditorSchema;
export const productEditorUpdateSchema = productEditorSchema;
export const variantBulkSchema = z.object({ variants: z.array(variantInputSchema).min(1).max(500) });
export const inventoryAdjustmentSchema = z.object({ variantId: z.string(), quantity: z.number().int(), reason: z.string().trim().min(3).max(300) });
