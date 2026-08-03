import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/http/api";
import { paiseToRupees, percentageDiscount } from "@/lib/money";
import { createCashfreeOrder, getCashfreeOrder } from "@/lib/cashfree/client";
import { env } from "@/config/env";
import { hashToken, randomToken } from "@/lib/security/crypto";
import type { z } from "zod";
import type { cartRequestSchema, checkoutSchema } from "./schemas";
type Cart = z.infer<typeof cartRequestSchema>;
type Checkout = z.infer<typeof checkoutSchema>;
export async function validateCart(input: Cart) {
  const settings = await prisma.storeSetting.findUnique({
    where: { id: "default" },
  });
  const products = await prisma.product.findMany({
    where: {
      id: { in: input.lines.map((l) => l.productId) },
      status: "PUBLISHED",
      active: true,
      deletedAt: null,
    },
    include: { variants: true },
  });
  let subtotal = 0;
  const lines = input.lines.map((line) => {
    const product = products.find(
      (p) => p.id === line.productId && p.slug === line.productSlug,
    );
    const variant = product?.variants.find(
      (v) => v.color === line.colorId && v.size === line.size && v.active,
    );
    const available = variant
      ? Math.max(0, variant.currentStock - variant.reservedStock)
      : 0;
    const regular =
      variant?.regularPricePaise ?? product?.regularPricePaise ?? 0;
    const sale = variant?.salePricePaise ?? product?.salePricePaise ?? null;
    const effective = sale ?? regular;
    subtotal += effective * line.quantity;
    return {
      productId: line.productId,
      colorId: line.colorId,
      size: line.size,
      requestedQuantity: line.quantity,
      maxQuantity: available,
      isAvailable: Boolean(product && variant && available >= line.quantity),
      unitPrice: paiseToRupees(regular),
      unitSalePrice: sale == null ? null : paiseToRupees(sale),
      priceChanged: false,
      ...(!product || !variant
        ? { message: "Product or variant is unavailable" }
        : available < line.quantity
          ? { message: `Only ${available} available` }
          : {}),
    };
  });
  let discount = 0,
    couponApplied: null | string = null,
    couponError: null | string = null;
  if (input.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: input.couponCode.trim().toUpperCase() },
    });
    const now = new Date();
    if (
      !coupon ||
      !coupon.active ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt < now) ||
      (coupon.minimumOrderPaise && subtotal < coupon.minimumOrderPaise)
    )
      couponError = "Coupon is invalid or not eligible";
    else {
      discount =
        coupon.type === "PERCENTAGE"
          ? percentageDiscount(subtotal, coupon.value)
          : coupon.value;
      if (coupon.maximumDiscountPaise)
        discount = Math.min(discount, coupon.maximumDiscountPaise);
      discount = Math.min(discount, subtotal);
      couponApplied = coupon.code;
    }
  }
  const shipping =
    settings?.freeShippingThresholdPaise &&
    subtotal - discount >= settings.freeShippingThresholdPaise
      ? 0
      : (settings?.shippingChargePaise ?? 0);
  return {
    lines,
    subtotalPaise: subtotal,
    discountPaise: discount,
    shippingPaise: shipping,
    totalPaise: subtotal - discount + shipping,
    couponApplied,
    couponError,
    messages: [],
    isCheckoutBlocked: lines.some((l) => !l.isAvailable),
  };
}
export async function checkout(input: Checkout, headerKey: string | undefined) {
  if (headerKey && headerKey !== input.idempotencyKey)
    throw new ApiError(
      "VALIDATION_ERROR",
      "Idempotency header and body must match",
      422,
    );
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (existing) {
    const p = existing.payments[0];
    if (!p)
      throw new ApiError(
        "CONFLICT",
        "Order exists without a payment session; contact support",
        409,
      );
    const cf = await getCashfreeOrder(p.providerOrderId);
    return {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      paymentSessionId: cf.payment_session_id,
      paymentGatewayOrderId: p.providerOrderId,
      amount: paiseToRupees(existing.totalPaise),
      currency: "INR" as const,
    };
  }
  const cart = await validateCart({ ...input, pincode: input.address.pincode });
  if (cart.isCheckoutBlocked)
    throw new ApiError(
      "PRODUCT_UNAVAILABLE",
      "One or more products are unavailable",
      409,
      { lines: cart.lines },
    );
  const token = randomToken();
  const order = await prisma.$transaction(
    async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: input.lines.map((l) => l.productId) } },
        include: { variants: true },
      });
      const customer = await tx.customer.create({
        data: {
          name: input.address.fullName,
          email: input.address.email.toLowerCase(),
          phone: input.address.phone,
          flags: [],
          addresses: { create: { ...input.address } },
        },
      });
      const prefix =
        (await tx.storeSetting.findUnique({ where: { id: "default" } }))
          ?.orderPrefix ?? "RUV";
      const created = await tx.order.create({
        data: {
          orderNumber: `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          secureTokenHash: hashToken(token),
          customerId: customer.id,
          subtotalPaise: cart.subtotalPaise,
          discountPaise: cart.discountPaise,
          shippingPaise: cart.shippingPaise,
          totalPaise: cart.totalPaise,
          couponCode: cart.couponApplied,
          shippingAddress: input.address,
          idempotencyKey: input.idempotencyKey,
          affiliateCode: input.affiliateCode,
          attribution: input.utm ?? {},
          items: {
            create: input.lines.map((line) => {
              const product = products.find((p) => p.id === line.productId)!;
              const variant = product.variants.find(
                (v) => v.color === line.colorId && v.size === line.size,
              )!;
              const price =
                variant.salePricePaise ??
                variant.regularPricePaise ??
                product.salePricePaise ??
                product.regularPricePaise;
              return {
                productId: product.id,
                variantId: variant.id,
                productName: product.name,
                sku: variant.sku,
                color: variant.colorLabel,
                size: variant.size,
                quantity: line.quantity,
                unitPricePaise: price,
                totalPaise: price * line.quantity,
              };
            }),
          },
          statusHistory: {
            create: { toStatus: "PENDING_PAYMENT", reason: "Checkout created" },
          },
        },
        include: { items: true },
      });
      for (const item of created.items) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, currentStock: { gte: item.quantity } },
          data: { reservedStock: { increment: item.quantity } },
        });
        if (updated.count !== 1)
          throw new ApiError(
            "PRODUCT_UNAVAILABLE",
            `${item.sku} became unavailable`,
            409,
          );
        await tx.inventoryReservation.create({
          data: {
            variantId: item.variantId,
            orderId: created.id,
            orderItemId: item.id,
            quantity: item.quantity,
            expiresAt: new Date(Date.now() + 20 * 60_000),
          },
        });
      }
      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  let cf;
  try {
    cf = await createCashfreeOrder({
      orderId: order.id,
      amountRupees: paiseToRupees(order.totalPaise),
      customer: {
        id: order.customerId,
        name: input.address.fullName,
        email: input.address.email,
        phone: input.address.phone,
      },
      returnUrl: `${env.STOREFRONT_URL}/payment/status?orderId=${encodeURIComponent(order.id)}`,
      notifyUrl: `${env.APP_URL}/api/v1/webhooks/cashfree`,
      idempotencyKey: randomUUID(),
    });
  } catch (error) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAYMENT_PENDING" },
    });
    throw error;
  }
  await prisma.payment.create({
    data: {
      orderId: order.id,
      providerOrderId: cf.order_id,
      providerIdempotencyKey: randomUUID(),
      status: "CREATED",
      amountPaise: order.totalPaise,
    },
  });
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentSessionId: cf.payment_session_id,
    paymentGatewayOrderId: cf.order_id,
    amount: paiseToRupees(order.totalPaise),
    currency: "INR" as const,
    secureToken: token,
  };
}
export async function paymentStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw new ApiError("NOT_FOUND", "Order not found", 404);
  const payment = order.payments[0];
  if (!payment)
    throw new ApiError(
      "PAYMENT_PENDING",
      "Payment session is not available",
      202,
    );
  if (
    !["SUCCESS", "FAILED", "CANCELLED", "USER_DROPPED", "EXPIRED"].includes(
      payment.status,
    )
  ) {
    const cf = await getCashfreeOrder(payment.providerOrderId);
    if (cf.order_status === "PAID")
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: "SUCCESS" },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: "PAID" },
        }),
      ]);
  }
  const current = await prisma.payment.findUniqueOrThrow({
    where: { id: payment.id },
  });
  const status = current.status.toLowerCase() as
    | "created"
    | "pending"
    | "success"
    | "failed"
    | "cancelled"
    | "user_dropped"
    | "expired";
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status,
    amountPaid:
      status === "success" ? paiseToRupees(current.amountPaise) : null,
    canRetry: ["failed", "cancelled", "user_dropped", "expired"].includes(
      status,
    ),
    moneyMayBeDeducted: ["pending", "success", "user_dropped"].includes(status),
    message:
      status === "success"
        ? "Payment received. Your order is confirmed!"
        : status === "pending"
          ? "We are verifying your payment."
          : "Payment is not complete.",
  };
}
export async function retryPayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) throw new ApiError("NOT_FOUND", "Order not found", 404);
  if (order.status === "PAID")
    throw new ApiError("CONFLICT", "Order is already paid", 409);
  const address = order.shippingAddress as {
    fullName: string;
    email: string;
    phone: string;
  };
  const cf = await createCashfreeOrder({
    orderId: `${order.id}-${Date.now().toString(36)}`,
    amountRupees: paiseToRupees(order.totalPaise),
    customer: {
      id: order.customerId,
      name: address.fullName,
      email: address.email,
      phone: address.phone,
    },
    returnUrl: `${env.STOREFRONT_URL}/payment/status?orderId=${order.id}`,
    notifyUrl: `${env.APP_URL}/api/v1/webhooks/cashfree`,
    idempotencyKey: randomUUID(),
  });
  await prisma.payment.create({
    data: {
      orderId: order.id,
      providerOrderId: cf.order_id,
      providerIdempotencyKey: randomUUID(),
      status: "CREATED",
      amountPaise: order.totalPaise,
    },
  });
  return {
    paymentSessionId: cf.payment_session_id,
    paymentGatewayOrderId: cf.order_id,
    amount: paiseToRupees(order.totalPaise),
    currency: "INR" as const,
  };
}
export async function trackOrder(orderNumber: string, contact: string) {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      customer: {
        OR: [
          { email: { equals: contact, mode: "insensitive" } },
          { phone: contact },
        ],
      },
    },
  });
  if (!order)
    throw new ApiError("NOT_FOUND", "Order details did not match", 404);
  const token = randomToken();
  await prisma.order.update({
    where: { id: order.id },
    data: { secureTokenHash: hashToken(token) },
  });
  return { secureToken: token };
}
export async function orderByToken(token: string) {
  const order = await prisma.order.findUnique({
    where: { secureTokenHash: hashToken(token) },
    include: {
      items: {
        include: {
          product: {
            include: { media: { orderBy: { position: "asc" }, take: 1 } },
          },
        },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) throw new ApiError("NOT_FOUND", "Order link is invalid", 404);
  const a = order.shippingAddress as {
    fullName: string;
    addressLine: string;
    locality?: string;
    city: string;
    state: string;
    pincode: string;
  };
  const map: Record<string, string> = {
    PAID: "payment_received",
    CONFIRMED: "order_confirmed",
    SOURCING: "processing",
    READY_TO_SHIP: "processing",
    SHIPPED: "shipped",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
    REFUNDED: "refunded",
    PARTIALLY_REFUNDED: "refund_initiated",
  };
  const status = (map[order.status] ?? "availability_being_verified") as never;
  return {
    orderNumber: order.orderNumber,
    secureToken: token,
    status,
    paymentStatus: (order.payments[0]?.status ?? "PENDING").toLowerCase(),
    placedAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      productName: i.productName,
      productSlug: i.product.slug,
      image: {
        id: i.product.media[0]?.id ?? i.productId,
        url:
          i.product.media[0]?.secureUrl ??
          `${env.APP_URL}/brand-placeholder.svg`,
        alt: i.productName,
      },
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      unitPrice: paiseToRupees(i.unitPricePaise),
    })),
    subtotal: paiseToRupees(order.subtotalPaise),
    discount: paiseToRupees(order.discountPaise),
    shippingFee: paiseToRupees(order.shippingPaise),
    amountPaid:
      order.payments[0]?.status === "SUCCESS"
        ? paiseToRupees(order.totalPaise)
        : 0,
    shippingAddress: a,
    timeline: order.statusHistory.map((h) => ({
      status: (map[h.toStatus] ?? "availability_being_verified") as never,
      label: h.toStatus.replaceAll("_", " "),
      timestamp: h.createdAt.toISOString(),
      completed: true,
    })),
    estimatedDeliveryAt: null,
  };
}
