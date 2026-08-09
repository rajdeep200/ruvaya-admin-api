import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializableRetry";
import { ApiError } from "@/lib/http/api";

type Tx = Prisma.TransactionClient;

async function incrementReserved(tx: Tx, variantId: string, quantity: number) {
  const changed = await tx.$executeRaw`
    UPDATE "ProductVariant"
    SET "reservedStock" = "reservedStock" + ${quantity}
    WHERE "id" = ${variantId}
      AND "currentStock" - "reservedStock" >= ${quantity}
      AND ${quantity} > 0
  `;
  if (changed !== 1) throw new ApiError("PRODUCT_UNAVAILABLE", "Inventory became unavailable", 409);
}

export async function reserveOrderItems(tx: Tx, order: { id: string; items: { id: string; variantId: string; quantity: number }[] }, expiresAt: Date) {
  for (const item of order.items) {
    await incrementReserved(tx, item.variantId, item.quantity);
    await tx.inventoryReservation.create({
      data: { orderId: order.id, orderItemId: item.id, variantId: item.variantId, quantity: item.quantity, expiresAt },
    });
  }
}

export async function reactivateOrderReservations(tx: Tx, orderId: string, expiresAt: Date) {
  const reservations = await tx.inventoryReservation.findMany({ where: { orderId, status: { in: ["RELEASED", "EXPIRED"] } } });
  for (const reservation of reservations) {
    await incrementReserved(tx, reservation.variantId, reservation.quantity);
    await tx.inventoryReservation.update({
      where: { id: reservation.id },
      data: { status: "ACTIVE", expiresAt, releasedAt: null, consumedAt: null },
    });
  }
}

export async function consumeOrderReservations(tx: Tx, orderId: string) {
  const reservations = await tx.inventoryReservation.findMany({ where: { orderId, status: "ACTIVE" } });
  for (const reservation of reservations) {
    const claimed = await tx.inventoryReservation.updateMany({
      where: { id: reservation.id, status: "ACTIVE" },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
    if (!claimed.count) continue;
    const changed = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "currentStock" = "currentStock" - ${reservation.quantity},
          "reservedStock" = "reservedStock" - ${reservation.quantity}
      WHERE "id" = ${reservation.variantId}
        AND "currentStock" >= ${reservation.quantity}
        AND "reservedStock" >= ${reservation.quantity}
    `;
    if (changed !== 1) throw new Error(`Inventory invariant failed while consuming ${reservation.id}`);
    await tx.inventoryAdjustment.create({ data: { variantId: reservation.variantId, delta: -reservation.quantity, reason: "PAYMENT_RESERVATION_CONSUMED", reference: orderId } });
  }
}

export async function releaseOrderReservations(tx: Tx, orderId: string, status: "RELEASED" | "EXPIRED", reason: string) {
  const reservations = await tx.inventoryReservation.findMany({ where: { orderId, status: "ACTIVE" } });
  for (const reservation of reservations) {
    const claimed = await tx.inventoryReservation.updateMany({
      where: { id: reservation.id, status: "ACTIVE" },
      data: { status, releasedAt: new Date() },
    });
    if (!claimed.count) continue;
    const changed = await tx.productVariant.updateMany({
      where: { id: reservation.variantId, reservedStock: { gte: reservation.quantity } },
      data: { reservedStock: { decrement: reservation.quantity } },
    });
    if (changed.count !== 1) throw new Error(`Inventory invariant failed while releasing ${reservation.id}`);
    await tx.inventoryAdjustment.create({ data: { variantId: reservation.variantId, delta: 0, reason, reference: orderId } });
  }
}

export async function expireReservations(limit = 100) {
  const due = await prisma.inventoryReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
    select: { orderId: true }, distinct: ["orderId"], take: limit,
  });
  let expiredOrders = 0;
  for (const { orderId } of due) {
    await withSerializableRetry(() => prisma.$transaction(async (tx) => {
      await releaseOrderReservations(tx, orderId, "EXPIRED", "RESERVATION_EXPIRED");
      await tx.payment.updateMany({ where: { orderId, status: { in: ["CREATED", "PENDING"] } }, data: { status: "EXPIRED" } });
      await tx.order.updateMany({ where: { id: orderId, status: { in: ["PENDING_PAYMENT", "PAYMENT_PENDING"] } }, data: { status: "PAYMENT_PENDING" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    expiredOrders++;
  }
  return { expiredOrders };
}
