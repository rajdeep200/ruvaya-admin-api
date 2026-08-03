import { productListDto } from "@/contracts/public/mappers";
import { prisma } from "@/lib/db/prisma";
import { handleError, ok } from "@/lib/http/api";

const status = (start: Date, end: Date) => new Date() < start ? "upcoming" : new Date() > end ? "expired" : "active";

export async function GET() {
  try {
    const rows = await prisma.campaign.findMany({
      where: { status: "PUBLISHED" },
      include: { products: { where: { product: { media: { some: { secureUrl: { startsWith: "https://" } } } } }, include: { product: { include: { variants: { where: { active: true } }, media: { orderBy: { position: "asc" } }, measurements: true, collections: { include: { collection: true } }, reviews: { where: { status: "APPROVED" } } } } } } },
      orderBy: { startAt: "desc" },
    });
    return ok(rows.flatMap((campaign) => {
      const image = (campaign.hero as { image?: { id?: string; url?: string; alt?: string } })?.image;
      if (!image?.url?.startsWith("https://")) return [];
      return [{ id: campaign.id, slug: campaign.slug, title: campaign.name, ...(campaign.description ? { subtitle: campaign.description } : {}), bannerImage: { id: image.id ?? `campaign:${campaign.id}`, url: image.url, alt: image.alt ?? campaign.name }, startAt: campaign.startAt.toISOString(), endAt: campaign.endAt.toISOString(), showCountdown: true, status: status(campaign.startAt, campaign.endAt), terms: [], products: campaign.products.map((entry) => productListDto(entry.product)) }];
    }));
  } catch (error) { return handleError(error); }
}
