import "server-only";
import { PaymentStatus, Prisma } from "@prisma/client";
import { prismaTx } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializableRetry";
import { ApiError } from "@/lib/http/api";
import { hashToken } from "@/lib/security/crypto";
import { consumeOrderReservations, reactivateOrderReservations, releaseOrderReservations } from "@/modules/inventory/service";

const FAILURE_STATES = new Set<PaymentStatus>(["FAILED", "CANCELLED", "USER_DROPPED", "EXPIRED"]);

export async function transitionPayment(input: {
  paymentId: string;
  status: PaymentStatus;
  amountPaise?: number;
  currency?: string;
  providerPaymentId?: string;
  response?: object;
  reason: string;
}) {
  return withSerializableRetry(() => prismaTx.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { order: { include: { customer: true } } } });
    if (!payment) throw new ApiError("NOT_FOUND", "Payment not found", 404);
    if (payment.status === "SUCCESS") return { changed: false, status: payment.status };
    if (input.status === "SUCCESS") {
      if (input.amountPaise !== payment.amountPaise || (input.currency ?? "INR") !== payment.currency) {
        throw new ApiError("PAYMENT_FAILED", "Provider amount or currency does not match the order", 409);
      }
      const activeReservations = await tx.inventoryReservation.count({ where: { orderId: payment.orderId, status: "ACTIVE" } });
      if (!activeReservations) await reactivateOrderReservations(tx, payment.orderId, new Date(Date.now() + 5 * 60_000));
      const changed = await tx.payment.updateMany({ where: { id: payment.id, status: { not: "SUCCESS" } }, data: { status: "SUCCESS" } });
      if (!changed.count) return { changed: false, status: "SUCCESS" as const };
      await tx.paymentAttempt.create({ data: { paymentId: payment.id, providerPaymentId: input.providerPaymentId, status: "SUCCESS", amountPaise: payment.amountPaise, response: input.response ?? {} } });
      await consumeOrderReservations(tx, payment.orderId);
      const orderChanged = await tx.order.updateMany({ where: { id: payment.orderId, status: { in: ["PENDING_PAYMENT", "PAYMENT_PENDING"] } }, data: { status: "PAID" } });
      if (orderChanged.count) {
        await tx.orderStatusHistory.create({ data: { orderId: payment.orderId, fromStatus: payment.order.status, toStatus: "PAID", reason: input.reason } });
        const template = await tx.notificationTemplate.findUnique({ where: { key: "payment_successful" } });
        if (template) await tx.notificationDelivery.create({ data: { templateId: template.id, recipientHash: hashToken(payment.order.customer.email ?? payment.order.customer.phone ?? payment.orderId) } });
      }
      return { changed: true, status: "SUCCESS" as const };
    }
    if (!FAILURE_STATES.has(input.status)) {
      if (payment.status === "CREATED") await tx.payment.update({ where: { id: payment.id }, data: { status: input.status } });
      return { changed: payment.status === "CREATED", status: input.status };
    }
    await tx.payment.update({ where: { id: payment.id }, data: { status: input.status } });
    await tx.paymentAttempt.create({ data: { paymentId: payment.id, providerPaymentId: input.providerPaymentId, status: input.status, amountPaise: input.amountPaise ?? payment.amountPaise, response: input.response ?? {} } });
    await releaseOrderReservations(tx, payment.orderId, input.status === "EXPIRED" ? "EXPIRED" : "RELEASED", `PAYMENT_${input.status}`);
    await tx.order.updateMany({ where: { id: payment.orderId, status: { in: ["PENDING_PAYMENT", "PAYMENT_PENDING"] } }, data: { status: "PAYMENT_PENDING" } });
    return { changed: true, status: input.status };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
