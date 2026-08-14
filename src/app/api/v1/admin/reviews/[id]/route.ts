import { z } from "zod";
import { ReviewStatus } from "@prisma/client";
import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { prisma, prismaTx } from "@/lib/db/prisma";
import { audit } from "@/modules/audit/service";
import { destroyCloudinaryResource } from "@/lib/cloudinary/client";
import { revalidateProduct } from "@/modules/storefront/revalidation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("reviews.write");
    const input = z
      .object({
        status: z.nativeEnum(ReviewStatus).optional(),
        featured: z.boolean().optional(),
        adminReply: z.string().max(2000).optional(),
      })
      .parse(await parseJson(request));
    const id = (await params).id;
    const before = await prisma.review.findUniqueOrThrow({
      where: { id },
      include: { product: { select: { slug: true } } },
    });
    const after = await prismaTx.$transaction(async (tx) => {
      const v = await tx.review.update({ where: { id }, data: { status: input.status, featured: input.featured } });
      if (input.adminReply) await tx.reviewReply.create({ data: { reviewId: id, body: input.adminReply, adminUserId: admin.id } });
      return v;
    });
    await audit({ adminUserId: admin.id, action: "REVIEW_MODERATED", entityType: "Review", entityId: id, before, after });
    // A status change alters the product's public rating average/count, and
    // the storefront caches that on the product detail page — without this,
    // a newly approved review stays invisible in the rating badge until the
    // page's own 5-minute ISR window happens to lapse.
    const revalidation = await revalidateProduct("review moderated", before.product);
    return ok({ ...after, revalidation });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("reviews.write");
    const id = (await params).id;
    const before = await prisma.review.findUniqueOrThrow({
      where: { id },
      include: { media: true, product: { select: { slug: true } } },
    });
    await prisma.review.delete({ where: { id } });
    await Promise.all(
      before.media.map((m) => destroyCloudinaryResource(m.publicId, "image").catch(() => undefined)),
    );
    await audit({ adminUserId: admin.id, action: "REVIEW_DELETED", entityType: "Review", entityId: id, before });
    const revalidation = await revalidateProduct("review deleted", before.product);
    return ok({ deleted: true, revalidation });
  } catch (error) {
    return handleError(error);
  }
}
