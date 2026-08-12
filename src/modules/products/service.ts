import "server-only";
import { Prisma, ProductStatus } from "@prisma/client";
import { prisma, prismaTx } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializableRetry";
import { ApiError } from "@/lib/http/api";
import { audit } from "@/modules/audit/service";
import type { z } from "zod";
import type {
  productDraftSchema,
  productEditorSchema,
  variantInputSchema,
} from "./schemas";

type EditorInput = z.infer<typeof productEditorSchema>;
type VariantInput = z.infer<typeof variantInputSchema>;
const publicInclude = {
  variants: { where: { active: true }, orderBy: { position: "asc" as const } },
  media: {
    where: { deletedAt: null, uploadStatus: "CONFIRMED" as const },
    orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }],
  },
  measurements: true,
  collections: { include: { collection: true } },
  reviews: { where: { status: "APPROVED" as const } },
};
const adminInclude = {
  variants: {
    orderBy: { position: "asc" as const },
    include: {
      adjustments: { orderBy: { createdAt: "desc" as const }, take: 10 },
    },
  },
  media: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }],
  },
  measurements: { orderBy: { size: "asc" as const } },
  collections: { include: { collection: true } },
  sources: { orderBy: { createdAt: "asc" as const } },
};

export async function listPublicProducts(query: {
  collection?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    active: true,
    deletedAt: null,
    media: {
      some: {
        deletedAt: null,
        uploadStatus: "CONFIRMED",
        secureUrl: { startsWith: "https://res.cloudinary.com/" },
      },
    },
    ...(query.collection
      ? {
          collections: {
            some: { collection: { slug: query.collection, active: true } },
          },
        }
      : {}),
  };
  const [items, totalItems] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: publicInclude,
      orderBy: [{ sortPriority: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  return { items, totalItems };
}

export async function getPublicProduct(slug: string) {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      active: true,
      deletedAt: null,
      media: {
        some: {
          deletedAt: null,
          uploadStatus: "CONFIRMED",
          secureUrl: { startsWith: "https://res.cloudinary.com/" },
        },
      },
    },
    include: publicInclude,
  });
  if (!product) throw new ApiError("NOT_FOUND", "Product not found", 404);
  return product;
}

/** Same shape/visibility rules as getPublicProduct, for resolving admin-picked
 * product IDs (e.g. homepage best-sellers) into public DTO-ready records. */
export async function getProductsForDto(ids: string[]) {
  if (!ids.length) return [];
  return prisma.product.findMany({
    where: {
      id: { in: ids },
      status: "PUBLISHED",
      active: true,
      deletedAt: null,
      media: {
        some: {
          deletedAt: null,
          uploadStatus: "CONFIRMED",
          secureUrl: { startsWith: "https://res.cloudinary.com/" },
        },
      },
    },
    include: publicInclude,
  });
}

export async function listAdminProducts(page: number, pageSize: number) {
  const [items, totalItems] = await prisma.$transaction([
    prisma.product.findMany({
      where: { deletedAt: null },
      include: { variants: true, media: { where: { deletedAt: null } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where: { deletedAt: null } }),
  ]);
  return { items, totalItems };
}

export async function getAdminProduct(id: string) {
  const [product, collections] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: adminInclude }),
    prisma.collection.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        publishedAt: true,
      },
    }),
  ]);
  if (!product || product.deletedAt)
    throw new ApiError("NOT_FOUND", "Product not found", 404);
  return { product, collections };
}

export async function createProductDraft(
  input: z.infer<typeof productDraftSchema>,
  adminUserId: string,
) {
  try {
    const product = await prisma.product.create({
      data: {
        ...input,
        shortDescription: "Draft product",
        fullDescription: "Draft product",
        regularPricePaise: 0,
        fabric: "Other",
        occasions: [],
        washCare: [],
        shippingInfo: "Use store default",
        status: "DRAFT",
        active: false,
      },
    });
    await audit({
      adminUserId,
      action: "PRODUCT_DRAFT_CREATED",
      entityType: "Product",
      entityId: product.id,
      after: product,
    });
    return product;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(
        "CONFLICT",
        "Slug or internal code already exists",
        409,
        { fields: error.meta?.target },
      );
    throw error;
  }
}

function productData(input: EditorInput) {
  const { variants, measurements, collectionIds, sources, ...data } = input;
  void variants;
  void measurements;
  void collectionIds;
  void sources;
  return {
    ...data,
    publishStartAt: data.publishStartAt ? new Date(data.publishStartAt) : null,
    publishEndAt: data.publishEndAt ? new Date(data.publishEndAt) : null,
  };
}

async function upsertVariant(
  tx: Prisma.TransactionClient,
  productId: string,
  input: VariantInput,
  adminUserId: string,
) {
  const data = {
    sku: input.sku,
    color: input.color,
    colorLabel: input.colorLabel,
    colorHex: input.colorHex,
    size: input.size,
    position: input.position,
    regularPricePaise: input.regularPricePaise,
    salePricePaise: input.salePricePaise,
    costPricePaise: input.costPricePaise,
    lowStockThreshold: input.lowStockThreshold,
    active: input.active,
    weightGrams: input.weightGrams,
    mediaId: input.mediaId,
  };
  if (!input.id) {
    const created = await tx.productVariant.create({
      data: { productId, ...data, currentStock: input.openingStock },
    });
    if (input.openingStock)
      await tx.inventoryAdjustment.create({
        data: {
          variantId: created.id,
          delta: input.openingStock,
          previousStock: 0,
          newStock: input.openingStock,
          reason: "OPENING_STOCK",
          adminUserId,
        },
      });
    return created.id;
  }
  const existing = await tx.productVariant.findFirst({
    where: { id: input.id, productId },
  });
  if (!existing)
    throw new ApiError(
      "NOT_FOUND",
      "Variant does not belong to this product",
      404,
    );
  if (input.openingStock < existing.reservedStock)
    throw new ApiError(
      "CONFLICT",
      `Stock for ${existing.sku} cannot be below reserved stock`,
      409,
    );
  const delta = input.openingStock - existing.currentStock;
  await tx.productVariant.update({
    where: { id: existing.id },
    data: { ...data, currentStock: input.openingStock },
  });
  if (delta)
    await tx.inventoryAdjustment.create({
      data: {
        variantId: existing.id,
        delta,
        previousStock: existing.currentStock,
        newStock: input.openingStock,
        reason: "PRODUCT_EDITOR_STOCK_CHANGE",
        adminUserId,
      },
    });
  return existing.id;
}

export async function saveProduct(
  id: string,
  input: EditorInput,
  adminUserId: string,
) {
  let before = await prisma.product.findUnique({
    where: { id },
    include: adminInclude,
  });
  if (!before || before.deletedAt)
    throw new ApiError("NOT_FOUND", "Product not found", 404);
  try {
    const updated = await withSerializableRetry(() => prismaTx.$transaction(
      async (tx) => {
        before = await tx.product.findUniqueOrThrow({
          where: { id },
          include: adminInclude,
        });
        if (before.deletedAt)
          throw new ApiError("NOT_FOUND", "Product not found", 404);
        await tx.product.update({
          where: { id },
          data: { ...productData(input), version: { increment: 1 } },
        });
        const keptVariantIds: string[] = [];
        for (const variant of input.variants)
          keptVariantIds.push(
            await upsertVariant(tx, id, variant, adminUserId),
          );
        const toDeactivate = await tx.productVariant.findMany({
          where: { productId: id, id: { notIn: keptVariantIds }, active: true },
          select: { id: true, sku: true },
        });
        for (const variant of toDeactivate)
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              active: false,
              sku: `${variant.sku}-ARCHIVED-${variant.id.slice(-6)}`,
            },
          });
        await tx.productMeasurement.deleteMany({ where: { productId: id } });
        if (input.measurements.length)
          await tx.productMeasurement.createMany({
            data: input.measurements.map((measurement) => ({
              productId: id,
              ...measurement,
            })),
          });
        await tx.collectionProduct.deleteMany({ where: { productId: id } });
        const validCollections = await tx.collection.count({
          where: { id: { in: input.collectionIds } },
        });
        if (validCollections !== new Set(input.collectionIds).size)
          throw new ApiError(
            "VALIDATION_ERROR",
            "One or more selected collections no longer exist",
            422,
          );
        if (input.collectionIds.length)
          await tx.collectionProduct.createMany({
            data: [...new Set(input.collectionIds)].map(
              (collectionId, position) => ({
                productId: id,
                collectionId,
                position,
              }),
            ),
          });
        await tx.productSource.deleteMany({
          where: { productId: id, sourceOrders: { none: {} } },
        });
        for (const source of input.sources) {
          const { id: sourceId, lastCheckedAt, ...sourceData } = source;
          if (sourceId)
            await tx.productSource.update({
              where: { id: sourceId, productId: id },
              data: {
                ...sourceData,
                variantMapping: sourceData.variantMapping ?? Prisma.JsonNull,
                lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt) : null,
              },
            });
          else
            await tx.productSource.create({
              data: {
                productId: id,
                ...sourceData,
                variantMapping: sourceData.variantMapping ?? Prisma.JsonNull,
                lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt) : null,
              },
            });
        }
        return tx.product.findUniqueOrThrow({
          where: { id },
          include: adminInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 20_000,
      },
    ));
    await audit({
      adminUserId,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(
        "CONFLICT",
        "Slug, internal code, SKU, or product option is already in use",
        409,
        { fields: error.meta?.target },
      );
    throw error;
  }
}

export async function createProduct(input: EditorInput, adminUserId: string) {
  const draft = await createProductDraft(
    {
      name: input.name,
      slug: input.slug,
      internalCode: input.internalCode,
      category: input.category,
    },
    adminUserId,
  );
  return saveProduct(draft.id, input, adminUserId);
}

export async function updateProduct(
  id: string,
  input: EditorInput,
  adminUserId: string,
) {
  return saveProduct(id, input, adminUserId);
}

export async function publishProduct(id: string, adminUserId: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: true,
      media: { where: { deletedAt: null, uploadStatus: "CONFIRMED" } },
      collections: true,
    },
  });
  if (!product) throw new ApiError("NOT_FOUND", "Product not found", 404);
  const failures: string[] = [];
  if (!product.name || !product.slug || !product.internalCode)
    failures.push("Basic information is incomplete");
  if (
    product.regularPricePaise <= 0 ||
    (product.salePricePaise != null &&
      product.salePricePaise > product.regularPricePaise)
  )
    failures.push("Pricing is invalid");
  if (!product.fabric || !product.shippingInfo)
    failures.push("Attributes and shipping information are required");
  if (!product.variants.some((variant) => variant.active))
    failures.push("At least one active variant is required");
  if (
    product.variants.some(
      (variant) =>
        variant.currentStock < 0 ||
        variant.reservedStock < 0 ||
        variant.reservedStock > variant.currentStock,
    )
  )
    failures.push("Inventory configuration is invalid");
  if (!product.media.some((media) => media.isPrimary))
    failures.push("A confirmed primary image is required");
  if (failures.length)
    throw new ApiError(
      "VALIDATION_ERROR",
      "Product is not ready to publish",
      422,
      { failures },
    );
  const updated = await prisma.product.update({
    where: { id },
    data: {
      status: ProductStatus.PUBLISHED,
      active: true,
      publishStartAt: product.publishStartAt ?? new Date(),
    },
  });
  await audit({
    adminUserId,
    action: "PRODUCT_PUBLISHED",
    entityType: "Product",
    entityId: id,
    before: product,
    after: updated,
  });
  return updated;
}

export async function setProductStatus(
  id: string,
  status: "DRAFT" | "ARCHIVED",
  adminUserId: string,
) {
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new ApiError("NOT_FOUND", "Product not found", 404);
  const updated = await prisma.product.update({
    where: { id },
    data: { status, active: status !== "ARCHIVED" && before.active },
  });
  await audit({
    adminUserId,
    action: `PRODUCT_${status}`,
    entityType: "Product",
    entityId: id,
    before,
    after: updated,
  });
  return updated;
}

export async function duplicateProduct(id: string, adminUserId: string) {
  const source = await prisma.product.findUnique({
    where: { id },
    include: adminInclude,
  });
  if (!source) throw new ApiError("NOT_FOUND", "Product not found", 404);
  const suffix = Date.now().toString(36);
  const copy = await prisma.product.create({
    data: {
      name: `${source.name} Copy`,
      slug: `${source.slug}-copy-${suffix}`,
      internalCode: `${source.internalCode}-COPY-${suffix}`.slice(0, 80),
      shortDescription: source.shortDescription,
      fullDescription: source.fullDescription,
      category: source.category,
      regularPricePaise: source.regularPricePaise,
      salePricePaise: source.salePricePaise,
      costPricePaise: source.costPricePaise,
      fabric: source.fabric,
      fit: source.fit,
      occasions: source.occasions,
      washCare: source.washCare,
      shippingInfo: source.shippingInfo,
      status: "DRAFT",
      active: false,
      variants: {
        create: source.variants.map((variant, position) => ({
          sku: `${variant.sku}-COPY-${suffix}`.slice(0, 100),
          color: variant.color,
          colorLabel: variant.colorLabel,
          colorHex: variant.colorHex,
          size: variant.size,
          position,
          regularPricePaise: variant.regularPricePaise,
          salePricePaise: variant.salePricePaise,
          costPricePaise: variant.costPricePaise,
          currentStock: 0,
          lowStockThreshold: variant.lowStockThreshold,
          active: variant.active,
        })),
      },
      measurements: {
        create: source.measurements.map((measurement) => ({
          size: measurement.size,
          bustTenthsIn: measurement.bustTenthsIn,
          waistTenthsIn: measurement.waistTenthsIn,
          hipTenthsIn: measurement.hipTenthsIn,
          shoulderTenthsIn: measurement.shoulderTenthsIn,
          lengthTenthsIn: measurement.lengthTenthsIn,
          sleeveTenthsIn: measurement.sleeveTenthsIn,
        })),
      },
    },
  });
  await audit({
    adminUserId,
    action: "PRODUCT_DUPLICATED",
    entityType: "Product",
    entityId: copy.id,
    before: { sourceProductId: id },
    after: copy,
  });
  return copy;
}
