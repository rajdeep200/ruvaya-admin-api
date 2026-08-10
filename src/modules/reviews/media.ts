import "server-only";
import type { z } from "zod";
import { getCloudinaryResource, verifyUploadResponse } from "@/lib/cloudinary/client";
import { ApiError } from "@/lib/http/api";
import type { assetConfirmationSchema } from "@/modules/mediaAssets/schemas";

type Confirmation = z.infer<typeof assetConfirmationSchema>;
const ALLOWED_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const ALLOWED_VIDEO_FORMATS = new Set(["mp4", "webm"]);
const EXPECTED_FOLDER = "ruvaya/reviews";

/** Verifies a review-photo upload against Cloudinary and returns its details.
 * Does not persist anything — the row is only created once the review itself
 * is saved (see POST /api/v1/admin/reviews), so an abandoned upload leaves no
 * orphaned database record, only the Cloudinary asset. */
export async function confirmReviewMediaUpload(input: Confirmation) {
  if (input.folder !== EXPECTED_FOLDER || !input.publicId.startsWith(`${EXPECTED_FOLDER}/`))
    throw new ApiError("FORBIDDEN", "Upload is outside the reviews folder", 403);
  if (!verifyUploadResponse(input.publicId, input.version, input.signature))
    throw new ApiError("FORBIDDEN", "Cloudinary response signature is invalid", 403);

  const allowed = input.resourceType === "image" ? ALLOWED_IMAGE_FORMATS : ALLOWED_VIDEO_FORMATS;
  if (!allowed.has(input.format.toLowerCase()))
    throw new ApiError("VALIDATION_ERROR", "Media format is not allowed", 422);

  const provider = await getCloudinaryResource(input.publicId, input.resourceType).catch(() => {
    throw new ApiError("VALIDATION_ERROR", "Cloudinary asset could not be verified", 422);
  });
  if (
    provider.public_id !== input.publicId ||
    provider.version !== input.version ||
    provider.resource_type !== input.resourceType ||
    provider.format !== input.format ||
    provider.bytes !== input.bytes ||
    provider.width !== input.width ||
    provider.height !== input.height ||
    provider.folder !== EXPECTED_FOLDER ||
    provider.secure_url !== input.secureUrl
  )
    throw new ApiError("VALIDATION_ERROR", "Cloudinary metadata does not match the provider record", 422);

  return {
    publicId: input.publicId,
    secureUrl: input.secureUrl,
    width: input.width,
    height: input.height,
    altText: input.altText,
  };
}
