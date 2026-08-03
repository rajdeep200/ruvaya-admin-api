import "server-only";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/http/api";
import { rupeesToPaise } from "@/lib/money";
import { transitionPayment } from "./transitions";

type Payload = { type: string; data?: { test_object?: { test_key?: string }; order?: { order_id?: string; order_amount?: number; order_currency?: string }; payment?: { cf_payment_id?: string | number; payment_status?: string; payment_amount?: number; payment_currency?: string } } };
const PROVIDER_STATUS: Record<string, PaymentStatus> = { SUCCESS: "SUCCESS", FAILED: "FAILED", USER_DROPPED: "USER_DROPPED", CANCELLED: "CANCELLED", PENDING: "PENDING" };

export async function processCashfreeWebhook(payload: Payload, raw: unknown) {
  if (payload.type === "WEBHOOK" && payload.data?.test_object?.test_key === "test_value") {
    return { accepted: true, test: true };
  }
  const providerPaymentId = String(payload.data?.payment?.cf_payment_id ?? "");
  if (!providerPaymentId) throw new ApiError("VALIDATION_ERROR", "Webhook is missing payment identifiers", 422);
  const providerEventId = `${providerPaymentId}:${payload.type}`;
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { providerEventId } });
  if (existing?.processedAt) return { duplicate: true };
  const payment = await prisma.payment.findUnique({ where: { providerOrderId: String(payload.data?.order?.order_id) } });
  const event = await prisma.paymentWebhookEvent.upsert({ where: { providerEventId }, update: {}, create: { providerEventId, type: payload.type, signatureValid: true, payload: raw as object, paymentId: payment?.id } });
  if (!payment) { await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { error: "Payment not found" } }); return { accepted: true, unmatched: true }; }
  const status = PROVIDER_STATUS[payload.data?.payment?.payment_status ?? ""];
  if (!status) { await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: "Ignored unsupported provider status" } }); return { accepted: true, ignored: true }; }
  try {
    await transitionPayment({ paymentId: payment.id, status, amountPaise: rupeesToPaise(payload.data?.payment?.payment_amount ?? payload.data?.order?.order_amount ?? 0), currency: payload.data?.payment?.payment_currency ?? payload.data?.order?.order_currency ?? "INR", providerPaymentId, response: raw as object, reason: "Verified Cashfree webhook" });
    await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
  } catch (error) {
    await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { error: error instanceof Error ? error.message.slice(0, 500) : "Processing failed" } });
    throw error;
  }
  return { accepted: true };
}
