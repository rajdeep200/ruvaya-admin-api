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
    ? (content.bestSellers as { id: string }[])
    : [];
  const storedCollections = Array.isArray(content.shopByCollection)
    ? (content.shopByCollection as { id: string }[])
    : [];

  const [products, collections] = await Promise.all([
    storedBestSellers.length
      ? getProductsForDto(storedBestSellers.map((p) => p.id))
      : Promise.resolve([]),
    storedCollections.length
      ? prisma.collection.findMany({
          where: { id: { in: storedCollections.map((c) => c.id) }, active: true },
        })
      : Promise.resolve([]),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const bestSellers = storedBestSellers
    .map((ref) => productById.get(ref.id))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map(productListDto);

  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const shopByCollection = storedCollections
    .map((ref) => collectionById.get(ref.id))
    .filter(
      (c): c is NonNullable<typeof c> =>
        c != null && Boolean(c.imageUrl?.startsWith("https://")),
    )
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      image: { id: `collection:${c.id}`, url: c.imageUrl!, alt: c.name, width: 1200, height: 800 },
    }));

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
