import { env } from "@/config/env";
import { handleError, ok, ApiError } from "@/lib/http/api";
import { safeEqual } from "@/lib/security/crypto";
import { expireReservations } from "@/modules/inventory/service";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${env.AUTH_SECRET}`;
    if (!safeEqual(authorization, expected)) throw new ApiError("UNAUTHORIZED", "Invalid operations credential", 401);
    return ok(await expireReservations());
  } catch (error) {
    return handleError(error);
  }
}
