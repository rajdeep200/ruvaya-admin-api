import { handleError, ok, ApiError } from "@/lib/http/api";
import { prisma } from "@/lib/db/prisma";
import { getProductsForDto } from "@/modules/products/service";
import { productListDto } from "@/contracts/public/mappers";

/** The stored homepage content is a snapshot taken when the admin last saved
 * it (see composeHomepageContent) — product price/stock/availability can go
 * stale between edits. Re-resolve product- and collection-backed sections
 * live on every read, using the ids already embedded in the snapshot, and
 * fall back to the stored copy for anything that's no longer available. */
async function refreshContent(content: Record<string, unknown>) {
  const storedBestSellers = Array.isArray(content.bestSellers)
    ? (content.bestSellers as Record<string, unknown>[])
    : [];
  const storedCollections = Array.isArray(content.shopByCollection)
    ? (content.shopByCollection as Record<string, unknown>[])
    : [];

  const [products, collections] = await Promise.all([
    storedBestSellers.length
      ? getProductsForDto(storedBestSellers.map((p) => p.id as string))
      : Promise.resolve([]),
    storedCollections.length
      ? prisma.collection.findMany({
          where: { id: { in: storedCollections.map((c) => c.id as string) } },
        })
      : Promise.resolve([]),
  ]);

  // A product/collection can go unavailable (archived, deactivated, deleted)
  // without the admin re-saving the homepage config. Fall back to the stored
  // snapshot entry for those instead of dropping the tile, so the curated
  // layout doesn't silently shrink until the admin next updates it.
  const productById = new Map(products.map((p) => [p.id, p]));
  const bestSellers = storedBestSellers.map(
    (ref) => (productById.has(ref.id as string) ? productListDto(productById.get(ref.id as string)!) : ref),
  );

  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const shopByCollection = storedCollections.map((ref) => {
    const c = collectionById.get(ref.id as string);
    if (!c || !c.active || !c.imageUrl?.startsWith("https://")) return ref;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      image: { id: `collection:${c.id}`, url: c.imageUrl, alt: c.name, width: 1200, height: 800 },
    };
  });

  return { ...content, bestSellers, shopByCollection };
}

export async function GET() {
  try {
    const v =
      (await prisma.homepageVersion.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { version: "desc" },
      })) ?? (await prisma.homepageVersion.findFirst({ orderBy: { version: "desc" } }));
    if (!v) throw new ApiError("NOT_FOUND", "Homepage not found", 404);
    return ok(await refreshContent(v.content as Record<string, unknown>));
  } catch (e) {
    return handleError(e);
  }
}
