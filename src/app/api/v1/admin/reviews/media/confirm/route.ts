import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { assetConfirmationSchema } from "@/modules/mediaAssets/schemas";
import { confirmReviewMediaUpload } from "@/modules/reviews/media";

export async function POST(request: Request) {
  try {
    await requireAdmin("reviews.write");
    const input = assetConfirmationSchema.parse(await parseJson(request));
    return ok(await confirmReviewMediaUpload(input), 201);
  } catch (error) {
    return handleError(error);
  }
}
