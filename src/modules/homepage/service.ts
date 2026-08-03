import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getProductsForDto } from "@/modules/products/service";
import { productListDto } from "@/contracts/public/mappers";
import type { HomepageAdminInput } from "./schemas";

function toImageAsset(id: string, image: HomepageAdminInput["hero"]["image"]) {
  return { id, url: image.url, alt: image.alt, width: image.width, height: image.height };
}

/** Resolves admin-picked IDs (collections/products/reviews) into the full
 * denormalized public shape the storefront's homepage schema expects,
 * reusing the same DTO mappers the public product/collection APIs use. */
export async function composeHomepageContent(input: HomepageAdminInput) {
  const [collections, products, reviews] = await Promise.all([
    input.shopByCollectionIds.length
      ? prisma.collection.findMany({ where: { id: { in: input.shopByCollectionIds } } })
      : Promise.resolve([]),
    getProductsForDto(input.bestSellerProductIds),
    input.featuredReviewIds.length
      ? prisma.review.findMany({ where: { id: { in: input.featuredReviewIds }, status: "APPROVED" } })
      : Promise.resolve([]),
  ]);

  return {
    hero: {
      heading: input.hero.heading,
      subheading: input.hero.subheading,
      ctaLabel: input.hero.ctaLabel,
      ctaHref: input.hero.ctaHref,
      image: toImageAsset("hero", input.hero.image),
    },
    shopByCollection: collections
      .filter((c) => c.imageUrl?.startsWith("https://"))
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        image: { id: `collection:${c.id}`, url: c.imageUrl!, alt: c.name, width: 1200, height: 800 },
      })),
    bestSellers: products.map(productListDto),
    seasonalCampaign: input.seasonalCampaign
      ? {
          eyebrow: input.seasonalCampaign.eyebrow,
          title: input.seasonalCampaign.title,
          subtitle: input.seasonalCampaign.subtitle,
          ctaLabel: input.seasonalCampaign.ctaLabel,
          ctaHref: input.seasonalCampaign.ctaHref,
          image: toImageAsset("campaign", input.seasonalCampaign.image),
        }
      : null,
    trustItems: input.trustItems,
    featuredReviews: reviews.map((r) => ({ id: r.id, quote: r.text, name: r.displayName, rating: r.rating })),
    styleInspiration: input.styleInspiration.map((s) => ({
      id: s.id,
      image: toImageAsset(s.id, s.image),
      ...(s.href ? { href: s.href } : {}),
    })),
    newsletterHeading: input.newsletterHeading,
    newsletterSubtext: input.newsletterSubtext,
    whatsappHeading: input.whatsappHeading,
    whatsappSubtext: input.whatsappSubtext,
  };
}
