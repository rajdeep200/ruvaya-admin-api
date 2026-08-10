import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "@/config/env";
import { createCashfreeOrder, getCashfreeOrder } from "@/lib/cashfree/client";
import { prisma, prismaTx } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializableRetry";
import { ApiError } from "@/lib/http/api";
import { paiseToRupees, rupeesToPaise } from "@/lib/money";
import { reactivateOrderReservations } from "@/modules/inventory/service";
import { resolvePaymentCapability } from "@/modules/orders/checkout";
import { transitionPayment } from "./transitions";

export async function paymentStatus(capability: string) {
  const order = await resolvePaymentCapability(capability);
  const payment = order.payments[0];
  if (!payment) throw new ApiError("PAYMENT_PENDING", "Payment session is not available", 202);
  if (!["SUCCESS", "FAILED", "CANCELLED", "USER_DROPPED", "EXPIRED"].includes(payment.status)) {
    const cf = await getCashfreeOrder(payment.providerOrderId);
    if (cf.order_id !== payment.providerOrderId || cf.order_amount !== paiseToRupees(payment.amountPaise) || cf.order_currency !== payment.currency) throw new ApiError("PAYMENT_FAILED", "Cashfree order verification failed", 409);
    if (cf.order_status === "PAID") await transitionPayment({ paymentId: payment.id, status: "SUCCESS", amountPaise: rupeesToPaise(cf.order_amount), currency: cf.order_currency, response: cf as object, reason: "Verified Cashfree status reconciliation" });
  }
  const current = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  const status = current.status.toLowerCase() as "created" | "pending" | "success" | "failed" | "cancelled" | "user_dropped" | "expired";
  return { orderId: capability, orderNumber: order.orderNumber, status, amountPaid: status === "success" ? paiseToRupees(current.amountPaise) : null, canRetry: ["failed", "cancelled", "user_dropped", "expired"].includes(status), moneyMayBeDeducted: ["pending", "success", "user_dropped"].includes(status), message: status === "success" ? "Payment received. Your order is confirmed!" : status === "pending" ? "We are verifying your payment." : "Payment is not complete." };
}

export async function retryPayment(capability: string) {
  const order = await resolvePaymentCapability(capability);
  if (order.status === "PAID") throw new ApiError("CONFLICT", "Order is already paid", 409);
  const latest = order.payments[0];
  if (latest && !["FAILED", "CANCELLED", "USER_DROPPED", "EXPIRED"].includes(latest.status)) throw new ApiError("CONFLICT", "The current payment is not retryable", 409);
  const providerIdempotencyKey = randomUUID();
  const attemptNumber = await prisma.payment.count({ where: { orderId: order.id } });
  const providerOrderId = `rv_${order.id}_${attemptNumber + 1}`;
  const payment = await withSerializableRetry(() => prismaTx.$transaction(async (tx) => {
    await reactivateOrderReservations(tx, order.id, new Date(Date.now() + 20 * 60_000));
    return tx.payment.create({ data: { orderId: order.id, providerOrderId, providerIdempotencyKey, status: "CREATED", amountPaise: order.totalPaise } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  const address = order.shippingAddress as { fullName: string; email: string; phone: string };
  const cf = await createCashfreeOrder({ orderId: providerOrderId, amountRupees: paiseToRupees(order.totalPaise), customer: { id: order.customerId, name: address.fullName, email: address.email, phone: address.phone }, returnUrl: `${env.STOREFRONT_URL}/payment/status?orderId=${encodeURIComponent(capability)}`, notifyUrl: `${env.APP_URL}/api/v1/webhooks/cashfree`, idempotencyKey: providerIdempotencyKey });
  if (cf.order_id !== providerOrderId || cf.order_amount !== paiseToRupees(order.totalPaise) || cf.order_currency !== order.currency) throw new ApiError("PAYMENT_FAILED", "Cashfree retry response mismatch", 409);
  await prisma.payment.update({ where: { id: payment.id }, data: { paymentSessionId: cf.payment_session_id, providerResponse: cf as object } });
  return { paymentSessionId: cf.payment_session_id, paymentGatewayOrderId: cf.order_id, amount: paiseToRupees(order.totalPaise), currency: "INR" as const };
}
