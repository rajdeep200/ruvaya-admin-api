import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { assetUploadSignatureSchema } from "@/modules/mediaAssets/schemas";
import { reviewMediaUploadSignature } from "@/lib/cloudinary/client";

export async function POST(request: Request) {
  try {
    await requireAdmin("reviews.write");
    const input = assetUploadSignatureSchema.parse(await parseJson(request));
    return ok(reviewMediaUploadSignature(input.resourceType));
  } catch (error) {
    return handleError(error);
  }
}
