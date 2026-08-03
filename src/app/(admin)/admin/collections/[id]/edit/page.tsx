import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [collection, products] = await Promise.all([
    prisma.collection.findUnique({ where: { id }, include: { products: true } }),
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, internalCode: true },
    }),
  ]);
  if (!collection) notFound();

  return (
    <>
      <div className="header">
        <div>
          <h1>{collection.name}</h1>
          <p className="muted">{collection.slug}</p>
        </div>
      </div>
      <CollectionEditor
        allProducts={products}
        initial={{
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          imageUrl: collection.imageUrl,
          active: collection.active,
          publishedAt: collection.publishedAt?.toISOString() ?? null,
          position: collection.position,
          productIds: collection.products.map((p) => p.productId),
        }}
      />
    </>
  );
}
