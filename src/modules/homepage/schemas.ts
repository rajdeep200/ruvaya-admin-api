import { z } from "zod";

const imageInputSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().max(300).default(""),
});

export const homepageAdminInputSchema = z.object({
  hero: z.object({
    heading: z.string().min(1),
    subheading: z.string().default(""),
    ctaLabel: z.string().min(1),
    ctaHref: z.string().min(1),
    image: imageInputSchema,
  }),
  shopByCollectionIds: z.array(z.string()).default([]),
  bestSellerProductIds: z.array(z.string()).default([]),
  seasonalCampaign: z
    .object({
      eyebrow: z.string().default(""),
      title: z.string().min(1),
      subtitle: z.string().default(""),
      ctaLabel: z.string().min(1),
      ctaHref: z.string().min(1),
      image: imageInputSchema,
    })
    .nullable()
    .default(null),
  trustItems: z
    .array(
      z.object({
        id: z.string(),
        icon: z.enum(["fabric", "handcrafted", "returns", "shipping", "secure"]),
        title: z.string().min(1),
        description: z.string().default(""),
      }),
    )
    .default([]),
  featuredReviewIds: z.array(z.string()).default([]),
  styleInspiration: z
    .array(
      z.object({
        id: z.string(),
        image: imageInputSchema,
        href: z.string().optional(),
      }),
    )
    .default([]),
  newsletterHeading: z.string().default(""),
  newsletterSubtext: z.string().default(""),
  whatsappHeading: z.string().default(""),
  whatsappSubtext: z.string().default(""),
});
export type HomepageAdminInput = z.infer<typeof homepageAdminInputSchema>;
