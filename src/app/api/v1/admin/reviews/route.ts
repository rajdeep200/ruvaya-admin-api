import { z } from "zod";
import { ReviewStatus } from "@prisma/client";
import { handleError, ok, parseJson, ApiError } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/modules/audit/service";

const createReviewSchema = z.object({
  productId: z.string().min(1),
  displayName: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).default(""),
  text: z.string().min(1).max(4000),
  status: z.nativeEnum(ReviewStatus).default("APPROVED"),
  media: z.array(z.object({ publicId: z.string().min(1), secureUrl: z.string().url() })).default([]),
});

export async function GET() {
  try {
    await requireAdmin("reviews.write");
    return ok(
      await prisma.review.findMany({
        include: { product: true, media: true, replies: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin("reviews.write");
    const input = createReviewSchema.parse(await parseJson(request));

    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new ApiError("NOT_FOUND", "Product not found", 404);

    const review = await prisma.review.create({
      data: {
        productId: input.productId,
        rating: input.rating,
        title: input.title,
        text: input.text,
        status: input.status,
        displayName: input.displayName,
        displayConsent: true,
        verifiedPurchase: false,
        media: {
          create: input.media.map((m, position) => ({ publicId: m.publicId, secureUrl: m.secureUrl, position })),
        },
      },
      include: { product: true, media: true, replies: true },
    });
    await audit({
      adminUserId: admin.id,
      action: "REVIEW_CREATED",
      entityType: "Review",
      entityId: review.id,
      after: review,
    });
    return ok(review, 201);
  } catch (error) {
    return handleError(error);
  }
}
