import { z } from "zod";
import { ReviewStatus } from "@prisma/client";
import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/modules/audit/service";
import { destroyCloudinaryResource } from "@/lib/cloudinary/client";

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
    const before = await prisma.review.findUniqueOrThrow({ where: { id } });
    const after = await prisma.$transaction(async (tx) => {
      const v = await tx.review.update({ where: { id }, data: { status: input.status, featured: input.featured } });
      if (input.adminReply) await tx.reviewReply.create({ data: { reviewId: id, body: input.adminReply, adminUserId: admin.id } });
      return v;
    });
    await audit({ adminUserId: admin.id, action: "REVIEW_MODERATED", entityType: "Review", entityId: id, before, after });
    return ok(after);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("reviews.write");
    const id = (await params).id;
    const before = await prisma.review.findUniqueOrThrow({ where: { id }, include: { media: true } });
    await prisma.review.delete({ where: { id } });
    await Promise.all(
      before.media.map((m) => destroyCloudinaryResource(m.publicId, "image").catch(() => undefined)),
    );
    await audit({ adminUserId: admin.id, action: "REVIEW_DELETED", entityType: "Review", entityId: id, before });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
