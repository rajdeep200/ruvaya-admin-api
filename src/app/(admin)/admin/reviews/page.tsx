import { prisma } from "@/lib/db/prisma";
import { ReviewsAdmin } from "@/components/admin/ReviewsAdmin";

export default async function ReviewsPage() {
  const [products, reviews] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, internalCode: true },
    }),
    prisma.review.findMany({
      include: { product: true, media: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <>
      <div className="header">
        <div>
          <h1>Reviews</h1>
          <p className="muted">Moderation, verified-purchase status, and manually added reviews</p>
        </div>
      </div>
      <ReviewsAdmin
        allProducts={products}
        initialReviews={reviews.map((r) => ({
          id: r.id,
          productId: r.productId,
          productName: r.product.name,
          displayName: r.displayName,
          rating: r.rating,
          title: r.title,
          text: r.text,
          status: r.status,
          media: r.media.map((m) => ({ id: m.id, secureUrl: m.secureUrl })),
        }))}
      />
    </>
  );
}
