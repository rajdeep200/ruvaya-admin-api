import { prisma } from "@/lib/db/prisma";
import { handleError, ok } from "@/lib/http/api";

export async function GET() {
  try {
    const rows = await prisma.collection.findMany({ where: { active: true, publishedAt: { not: null }, imageUrl: { startsWith: "https://" } }, orderBy: { position: "asc" } });
    return ok(rows.map((collection) => ({ id: collection.id, slug: collection.slug, name: collection.name, image: { id: `collection:${collection.id}`, url: collection.imageUrl!, alt: collection.name, width: 1200, height: 800 } })));
  } catch (error) { return handleError(error); }
}
