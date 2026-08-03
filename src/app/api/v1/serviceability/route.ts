import { handleError, ok, ApiError } from "@/lib/http/api";
export async function GET(r: Request) {
  try {
    const p = new URL(r.url).searchParams.get("pincode");
    if (!p || !/^[1-9]\d{5}$/.test(p))
      throw new ApiError("VALIDATION_ERROR", "Valid pincode is required", 422);
    const blocked = p.startsWith("9");
    return ok({
      pincode: p,
      isServiceable: !blocked,
      codAvailable: false,
      ...(blocked
        ? { message: "Delivery is not currently available to this pincode" }
        : { estimatedDeliveryDays: 7, message: "Delivery available" }),
    });
  } catch (e) {
    return handleError(e);
  }
}
