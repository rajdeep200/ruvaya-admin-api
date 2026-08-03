import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function CollectionsPage() {
  const collections = await prisma.collection.findMany({
    include: { products: true },
    orderBy: { position: "asc" },
  });

  return (
    <>
      <div className="header">
        <div>
          <h1>Collections</h1>
          <p className="muted">Group products for the storefront and navigation menu.</p>
        </div>
        <Link className="btn" href="/admin/collections/new">
          Add collection
        </Link>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Products</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/collections/${c.id}/edit`}>{c.name}</Link>
                </td>
                <td className="muted">{c.slug}</td>
                <td>{c.products.length}</td>
                <td>
                  <span className="pill">
                    {!c.active ? "Archived" : c.publishedAt ? "Published" : "Draft"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!collections.length && <p className="muted">No collections yet. Add the first one to begin.</p>}
      </div>
    </>
  );
}
