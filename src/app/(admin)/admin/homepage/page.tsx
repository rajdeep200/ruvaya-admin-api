import { prisma } from "@/lib/db/prisma";
import { HomepageEditor } from "@/components/admin/HomepageEditor";

export default async function HomepagePage() {
  const [version, collections, products, reviews] = await Promise.all([
    prisma.homepageVersion.findFirst({ orderBy: { version: "desc" } }),
    prisma.collection.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true, imageUrl: true } }),
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, internalCode: true },
    }),
    prisma.review.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <div className="header">
        <div>
          <h1>Homepage CMS</h1>
          <p className="muted">Controls the storefront&apos;s homepage. Save & publish makes changes live immediately.</p>
        </div>
      </div>
      <HomepageEditor
        initialContent={version?.content ?? null}
        collections={collections}
        products={products}
        reviews={reviews.map((r) => ({
          id: r.id,
          productName: r.product.name,
          displayName: r.displayName,
          rating: r.rating,
          snippet: r.title || r.text.slice(0, 80),
        }))}
      />
    </>
  );
}
