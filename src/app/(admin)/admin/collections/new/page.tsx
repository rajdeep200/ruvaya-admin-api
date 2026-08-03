import { prisma } from "@/lib/db/prisma";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export default async function NewCollectionPage() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, internalCode: true },
  });

  return (
    <>
      <div className="header">
        <div>
          <h1>New collection</h1>
          <p className="muted">Group products together for the storefront.</p>
        </div>
      </div>
      <CollectionEditor allProducts={products} />
    </>
  );
}
