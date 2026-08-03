import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  destroyCloudinaryResource,
  getCloudinaryResource,
  productUploadSignature,
  verifyUploadResponse,
} from "@/lib/cloudinary/client";
import { ApiError } from "@/lib/http/api";
import { audit } from "@/modules/audit/service";
import type { z } from "zod";
import type { cloudinaryConfirmationSchema, mediaPatchSchema } from "./schemas";

type Confirmation = z.infer<typeof cloudinaryConfirmationSchema>;
const ALLOWED_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const ALLOWED_VIDEO_FORMATS = new Set(["mp4", "webm"]);

async function productOwned(productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
  });
  if (!product) throw new ApiError("NOT_FOUND", "Product not found", 404);
  return product;
}

export async function createUploadSignature(
  productId: string,
  resourceType: "image" | "video",
) {
  await productOwned(productId);
  return productUploadSignature(productId, resourceType);
}

export async function confirmUpload(input: Confirmation, adminUserId: string) {
  await productOwned(input.productId);
  const expectedFolder = `ruvaya/products/${input.productId}`;
  if (
    input.folder !== expectedFolder ||
    !input.publicId.startsWith(`${expectedFolder}/`)
  )
    throw new ApiError(
      "FORBIDDEN",
      "Upload is outside the product folder",
      403,
    );
  if (!verifyUploadResponse(input.publicId, input.version, input.signature))
    throw new ApiError(
      "FORBIDDEN",
      "Cloudinary response signature is invalid",
      403,
    );
  const allowed =
    input.resourceType === "image"
      ? ALLOWED_IMAGE_FORMATS
      : ALLOWED_VIDEO_FORMATS;
  if (!allowed.has(input.format.toLowerCase()))
    throw new ApiError("VALIDATION_ERROR", "Media format is not allowed", 422);
  const provider = await getCloudinaryResource(
    input.publicId,
    input.resourceType,
  ).catch(() => {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Cloudinary asset could not be verified",
      422,
    );
  });
  if (
    provider.public_id !== input.publicId ||
    provider.version !== input.version ||
    provider.resource_type !== input.resourceType ||
    provider.format !== input.format ||
    provider.bytes !== input.bytes ||
    provider.width !== input.width ||
    provider.height !== input.height ||
    provider.folder !== expectedFolder ||
    provider.secure_url !== input.secureUrl
  )
    throw new ApiError(
      "VALIDATION_ERROR",
      "Cloudinary metadata does not match the provider record",
      422,
    );
  if (input.variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: input.variantId, productId: input.productId },
    });
    if (!variant)
      throw new ApiError(
        "FORBIDDEN",
        "Variant does not belong to this product",
        403,
      );
  }
  const count = await prisma.productMedia.count({
    where: { productId: input.productId, deletedAt: null },
  });
  try {
    const media = await prisma.productMedia.create({
      data: {
        productId: input.productId,
        type: input.resourceType === "image" ? "IMAGE" : "VIDEO",
        resourceType: input.resourceType,
        format: input.format.toLowerCase(),
        version: input.version,
        folder: expectedFolder,
        cloudinaryPublicId: input.publicId,
        secureUrl: input.secureUrl,
        altText: input.altText,
        color: input.color,
        assignedVariantId: input.variantId,
        position: count,
        isPrimary: count === 0,
        width: input.width,
        height: input.height,
        bytes: input.bytes,
        mimeType:
          input.resourceType === "image"
            ? `image/${input.format.toLowerCase() === "jpg" ? "jpeg" : input.format.toLowerCase()}`
            : `video/${input.format.toLowerCase()}`,
        createdByAdminId: adminUserId,
      },
    });
    await audit({
      adminUserId,
      action: "PRODUCT_MEDIA_CONFIRMED",
      entityType: "ProductMedia",
      entityId: media.id,
      after: media,
    });
    return media;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return prisma.productMedia.findUniqueOrThrow({
        where: { cloudinaryPublicId: input.publicId },
      });
    throw error;
  }
}

export async function updateMedia(
  id: string,
  input: z.infer<typeof mediaPatchSchema>,
  adminUserId: string,
) {
  const before = await prisma.productMedia.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ApiError("NOT_FOUND", "Media not found", 404);
  if (input.variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: input.variantId, productId: before.productId },
    });
    if (!variant)
      throw new ApiError(
        "FORBIDDEN",
        "Variant does not belong to this product",
        403,
      );
  }
  const updated = await prisma.productMedia.update({
    where: { id },
    data: {
      altText: input.altText,
      color: input.color,
      assignedVariantId: input.variantId,
    },
  });
  await audit({
    adminUserId,
    action: "PRODUCT_MEDIA_UPDATED",
    entityType: "ProductMedia",
    entityId: id,
    before,
    after: updated,
  });
  return updated;
}

export async function reorderMedia(
  productId: string,
  mediaIds: string[],
  adminUserId: string,
) {
  const rows = await prisma.productMedia.findMany({
    where: { productId, id: { in: mediaIds }, deletedAt: null },
  });
  if (rows.length !== mediaIds.length)
    throw new ApiError(
      "FORBIDDEN",
      "Media reorder contains foreign or missing assets",
      403,
    );
  await prisma.$transaction(
    mediaIds.map((id, position) =>
      prisma.productMedia.update({ where: { id }, data: { position } }),
    ),
  );
  await audit({
    adminUserId,
    action: "PRODUCT_MEDIA_REORDERED",
    entityType: "Product",
    entityId: productId,
    after: { mediaIds },
  });
  return prisma.productMedia.findMany({
    where: { productId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
  });
}

export async function setPrimaryMedia(id: string, adminUserId: string) {
  const media = await prisma.productMedia.findFirst({
    where: { id, deletedAt: null, uploadStatus: "CONFIRMED", type: "IMAGE" },
  });
  if (!media) throw new ApiError("NOT_FOUND", "Usable image not found", 404);
  await prisma.$transaction([
    prisma.productMedia.updateMany({
      where: { productId: media.productId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.productMedia.update({ where: { id }, data: { isPrimary: true } }),
  ]);
  await audit({
    adminUserId,
    action: "PRODUCT_MEDIA_PRIMARY_SET",
    entityType: "ProductMedia",
    entityId: id,
    after: { productId: media.productId },
  });
  return prisma.productMedia.findUniqueOrThrow({ where: { id } });
}

export async function deleteMedia(id: string, adminUserId: string) {
  const media = await prisma.productMedia.findFirst({
    where: { id, deletedAt: null },
    include: { product: true, variants: true },
  });
  if (!media) throw new ApiError("NOT_FOUND", "Media not found", 404);
  const usableCount = await prisma.productMedia.count({
    where: {
      productId: media.productId,
      id: { not: id },
      deletedAt: null,
      uploadStatus: "CONFIRMED",
      type: "IMAGE",
    },
  });
  if (media.product.status === "PUBLISHED" && usableCount === 0)
    throw new ApiError(
      "CONFLICT",
      "A published product must retain a usable image",
      409,
    );
  await prisma.productMedia.update({
    where: { id },
    data: { uploadStatus: "DELETE_PENDING" },
  });
  let providerResult: { result?: string };
  try {
    providerResult = await destroyCloudinaryResource(
      media.cloudinaryPublicId,
      media.resourceType as "image" | "video",
    );
  } catch (error) {
    await prisma.productMedia.update({
      where: { id },
      data: {
        uploadStatus: "CONFIRMED",
        orphanReason:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Cloudinary deletion failed",
      },
    });
    throw new ApiError(
      "INTERNAL_ERROR",
      "Cloudinary deletion failed; the database record was retained",
      502,
    );
  }
  if (
    !providerResult ||
    !["ok", "not found"].includes(providerResult.result ?? "")
  ) {
    await prisma.productMedia.update({
      where: { id },
      data: {
        uploadStatus: "ORPHANED",
        orphanReason: `Unexpected Cloudinary result: ${providerResult?.result}`,
      },
    });
    throw new ApiError(
      "INTERNAL_ERROR",
      "Cloudinary deletion requires reconciliation",
      502,
    );
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.updateMany({
        where: { mediaId: id },
        data: { mediaId: null },
      });
      await tx.productMedia.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          uploadStatus: "ARCHIVED",
          isPrimary: false,
        },
      });
      if (media.isPrimary) {
        const replacement = await tx.productMedia.findFirst({
          where: {
            productId: media.productId,
            deletedAt: null,
            uploadStatus: "CONFIRMED",
            type: "IMAGE",
          },
          orderBy: { position: "asc" },
        });
        if (replacement)
          await tx.productMedia.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          });
      }
    });
  } catch {
    throw new ApiError(
      "INTERNAL_ERROR",
      "Cloudinary asset was deleted but database cleanup needs reconciliation",
      500,
      { mediaId: id },
    );
  }
  await audit({
    adminUserId,
    action: "PRODUCT_MEDIA_DELETED",
    entityType: "ProductMedia",
    entityId: id,
    before: media,
  });
  return { deleted: true };
}
