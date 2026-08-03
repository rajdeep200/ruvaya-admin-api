import { ApiError, handleError, ok } from "@/lib/http/api";
import { verifyCashfreeWebhook } from "@/lib/cashfree/client";
import { processCashfreeWebhook } from "@/modules/payments/webhook";

const REPLAY_WINDOW_MS = 5 * 60_000;

export function cashfreeTimestampMilliseconds(value: string) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new ApiError("UNAUTHORIZED", "Invalid webhook timestamp", 401);
  }
  // Cashfree dashboard tests may send Unix seconds while payment webhooks may
  // send Unix milliseconds. Normalize both formats before replay validation.
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const timestamp = request.headers.get("x-webhook-timestamp");
    const signature = request.headers.get("x-webhook-signature");
    if (!timestamp || !signature || !verifyCashfreeWebhook(raw, timestamp, signature)) {
      throw new ApiError("UNAUTHORIZED", "Invalid webhook signature", 401);
    }
    const timestampMs = cashfreeTimestampMilliseconds(timestamp);
    if (Math.abs(Date.now() - timestampMs) > REPLAY_WINDOW_MS) {
      throw new ApiError("UNAUTHORIZED", "Webhook timestamp is outside the replay window", 401);
    }
    const payload = JSON.parse(raw);
    return ok(await processCashfreeWebhook(payload, payload));
  } catch (error) {
    return handleError(error);
  }
}
