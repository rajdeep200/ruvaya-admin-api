import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { env } from "@/config/env";
import { createCashfreeOrder, getCashfreeOrder, type CashfreeOrder } from "@/lib/cashfree/client";
import { prisma, prismaTx } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializableRetry";
import { ApiError } from "@/lib/http/api";
import { paiseToRupees } from "@/lib/money";
import { hashToken, randomToken } from "@/lib/security/crypto";
import { reserveOrderItems } from "@/modules/inventory/service";
import { checkoutSchema } from "./schemas";
import { validateCart } from "./service";

type Checkout = z.infer<typeof checkoutSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function requestHash(input: Checkout) {
  return createHash("sha256").update(canonical({ ...input, lines: [...input.lines].sort((a, b) => `${a.productId}:${a.colorId}:${a.size}`.localeCompare(`${b.productId}:${b.colorId}:${b.size}`)), couponCode: input.couponCode?.trim().toUpperCase(), address: { ...input.address, email: input.address.email.trim().toLowerCase() } })).digest("hex");
}

function safeResponse(order: { orderNumber: string; totalPaise: number; paymentCapabilityHash: string | null }, payment: { providerOrderId: string; paymentSessionId: string | null }, paymentCapability: string) {
  if (!payment.paymentSessionId) throw new ApiError("PAYMENT_PENDING", "Payment session creation is still being reconciled", 202);
  return { orderId: paymentCapability, orderNumber: order.orderNumber, paymentSessionId: payment.paymentSessionId, paymentGatewayOrderId: payment.providerOrderId, amount: paiseToRupees(order.totalPaise), currency: "INR" as const };
}

async function recoverOrCreateProviderOrder(operationId: string, input: Checkout, capability: string) {
  const operation = await prisma.checkoutOperation.findUniqueOrThrow({ where: { id: operationId }, include: { order: { include: { customer: true, payments: true } } } });
  const order = operation.order!;
  const payment = order.payments[0];
  let cf: CashfreeOrder;
  try {
    cf = await getCashfreeOrder(operation.providerOrderId!);
  } catch {
    cf = await createCashfreeOrder({ orderId: operation.providerOrderId!, amountRupees: paiseToRupees(order.totalPaise), customer: { id: order.customerId, name: input.address.fullName, email: input.address.email, phone: input.address.phone }, returnUrl: `${env.STOREFRONT_URL}/payment/status?orderId=${encodeURIComponent(capability)}`, notifyUrl: `${env.APP_URL}/api/v1/webhooks/cashfree`, idempotencyKey: operation.providerIdempotencyKey });
  }
  if (cf.order_id !== operation.providerOrderId || cf.order_amount !== paiseToRupees(order.totalPaise) || cf.order_currency !== order.currency) throw new ApiError("PAYMENT_FAILED", "Cashfree order identity, amount, or currency mismatch", 409);
  const response = safeResponse(order, { providerOrderId: payment.providerOrderId, paymentSessionId: cf.payment_session_id }, capability);
  await prisma.$transaction([prisma.payment.update({ where: { id: payment.id }, data: { paymentSessionId: cf.payment_session_id, providerResponse: cf as object } }), prisma.checkoutOperation.update({ where: { id: operation.id }, data: { state: "COMPLETED", safeResponse: response } })]);
  return response;
}

export async function checkout(input: Checkout, headerKey: string | undefined, accountId: string) {
  if (!headerKey) throw new ApiError("VALIDATION_ERROR", "Idempotency-Key header is required", 422);
  if (headerKey !== input.idempotencyKey) throw new ApiError("VALIDATION_ERROR", "Idempotency header and body must match", 422);
  const hash = requestHash(input);
  const existing = await prisma.checkoutOperation.findUnique({ where: { operationType_idempotencyKey: { operationType: "CHECKOUT", idempotencyKey: headerKey } }, include: { order: { include: { payments: true } } } });
  if (existing) {
    if (existing.requestHash !== hash) throw new ApiError("IDEMPOTENCY_CONFLICT", "Idempotency key was already used with a different checkout request", 409);
    if (existing.state === "COMPLETED" && existing.safeResponse) return existing.safeResponse;
    if (existing.state === "PROCESSING") throw new ApiError("IDEMPOTENCY_IN_PROGRESS", "Checkout is already processing; retry shortly with the same key", 409);
    if (existing.orderId && existing.paymentCapability) return recoverOrCreateProviderOrder(existing.id, input, existing.paymentCapability);
    throw new ApiError("PAYMENT_PENDING", "Checkout requires reconciliation before it can be retried", 503);
  }
  const providerIdempotencyKey = randomUUID();
  let operation;
  try {
    operation = await prisma.checkoutOperation.create({ data: { operationType: "CHECKOUT", idempotencyKey: headerKey, requestHash: hash, providerIdempotencyKey, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.checkoutOperation.findUniqueOrThrow({ where: { operationType_idempotencyKey: { operationType: "CHECKOUT", idempotencyKey: headerKey } } });
      if (winner.requestHash !== hash) throw new ApiError("IDEMPOTENCY_CONFLICT", "Idempotency key was already used with a different checkout request", 409);
      throw new ApiError("IDEMPOTENCY_IN_PROGRESS", "Checkout is already processing; retry shortly with the same key", 409);
    }
    throw error;
  }
  const providerOrderId = `rv_${operation.id}`;
  const capability = randomToken();
  try {
    const cart = await validateCart({ ...input, pincode: input.address.pincode });
    if (cart.isCheckoutBlocked) throw new ApiError("PRODUCT_UNAVAILABLE", "One or more products are unavailable", 409, { lines: cart.lines });
    await withSerializableRetry(() => prismaTx.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: input.lines.map((line) => line.productId) }, status: "PUBLISHED", active: true, deletedAt: null }, include: { variants: true } });
      const { fullName, phone, email, addressLine, locality, landmark, city, state, pincode } = input.address;
      const customer = await tx.customer.create({ data: { name: fullName, email: email.toLowerCase(), phone, flags: [], addresses: { create: { fullName, phone, email, addressLine, locality, landmark, city, state, pincode } } } });
      const prefix = (await tx.storeSetting.findUnique({ where: { id: "default" } }))?.orderPrefix ?? "RUV";
      const order = await tx.order.create({ data: { orderNumber: `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`, secureTokenHash: hashToken(randomToken()), paymentCapabilityHash: hashToken(capability), paymentCapabilityExpiresAt: new Date(Date.now() + 24 * 60 * 60_000), customerId: customer.id, accountId, subtotalPaise: cart.subtotalPaise, discountPaise: cart.discountPaise, shippingPaise: cart.shippingPaise, totalPaise: cart.totalPaise, couponCode: cart.couponApplied, shippingAddress: input.address, idempotencyKey: input.idempotencyKey, affiliateCode: input.affiliateCode, attribution: input.utm ?? {}, items: { create: input.lines.map((line) => { const product = products.find((item) => item.id === line.productId); const variant = product?.variants.find((item) => item.color === line.colorId && item.size === line.size && item.active); if (!product || !variant) throw new ApiError("PRODUCT_UNAVAILABLE", "Product or variant is unavailable", 409); const price = variant.salePricePaise ?? variant.regularPricePaise ?? product.salePricePaise ?? product.regularPricePaise; return { productId: product.id, variantId: variant.id, productName: product.name, sku: variant.sku, color: variant.colorLabel, size: variant.size, quantity: line.quantity, unitPricePaise: price, totalPaise: price * line.quantity }; }), }, statusHistory: { create: { toStatus: "PENDING_PAYMENT", reason: "Checkout created" } } }, include: { items: true } });
      await reserveOrderItems(tx, order, new Date(Date.now() + 20 * 60_000));
      await tx.payment.create({ data: { orderId: order.id, providerOrderId, providerIdempotencyKey, status: "CREATED", amountPaise: order.totalPaise } });
      await tx.checkoutOperation.update({ where: { id: operation.id }, data: { orderId: order.id, providerOrderId, paymentCapability: capability } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    return await recoverOrCreateProviderOrder(operation.id, input, capability);
  } catch (error) {
    await prisma.checkoutOperation.update({ where: { id: operation.id }, data: { state: "FAILED", failureCode: error instanceof ApiError ? error.code : "INTERNAL_ERROR", failureMessage: error instanceof Error ? error.message : "Unknown failure" } }).catch(() => undefined);
    throw error;
  }
}

export async function resolvePaymentCapability(token: string) {
  const order = await prisma.order.findUnique({ where: { paymentCapabilityHash: hashToken(token) }, include: { customer: true, payments: { orderBy: { createdAt: "desc" }, take: 1 }, reservations: true } });
  if (!order || !order.paymentCapabilityExpiresAt || order.paymentCapabilityExpiresAt <= new Date()) throw new ApiError("AUTH_EXPIRED", "Payment capability is invalid or expired", 401);
  return order;
}

export async function rotatePaymentCapability(orderId: string) {
  const capability = randomToken();
  await prisma.order.update({ where: { id: orderId }, data: { paymentCapabilityHash: hashToken(capability), paymentCapabilityExpiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
  return capability;
}
