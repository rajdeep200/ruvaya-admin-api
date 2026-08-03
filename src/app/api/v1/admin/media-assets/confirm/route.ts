import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { assetConfirmationSchema } from "@/modules/mediaAssets/schemas";
import { confirmAssetUpload } from "@/modules/mediaAssets/service";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin("marketing.write");
    const input = assetConfirmationSchema.parse(await parseJson(request));
    return ok(await confirmAssetUpload(input, admin.id), 201);
  } catch (error) {
    return handleError(error);
  }
}
