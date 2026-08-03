import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { assetUploadSignatureSchema } from "@/modules/mediaAssets/schemas";
import { createAssetUploadSignature } from "@/modules/mediaAssets/service";

export async function POST(request: Request) {
  try {
    await requireAdmin("marketing.write");
    const input = assetUploadSignatureSchema.parse(await parseJson(request));
    return ok(createAssetUploadSignature(input.resourceType));
  } catch (error) {
    return handleError(error);
  }
}
