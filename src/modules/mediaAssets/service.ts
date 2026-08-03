import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCloudinaryResource, siteAssetUploadSignature, verifyUploadResponse } from "@/lib/cloudinary/client";
import { ApiError } from "@/lib/http/api";
import { audit } from "@/modules/audit/service";
import type { assetConfirmationSchema } from "./schemas";

type Confirmation = z.infer<typeof assetConfirmationSchema>;
const ALLOWED_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const ALLOWED_VIDEO_FORMATS = new Set(["mp4", "webm"]);
const EXPECTED_FOLDER = "ruvaya/site-assets";

export function createAssetUploadSignature(resourceType: "image" | "video") {
  return siteAssetUploadSignature(resourceType);
}

export async function confirmAssetUpload(input: Confirmation, adminUserId: string) {
  if (input.folder !== EXPECTED_FOLDER || !input.publicId.startsWith(`${EXPECTED_FOLDER}/`))
    throw new ApiError("FORBIDDEN", "Upload is outside the site assets folder", 403);
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

  const asset = await prisma.mediaAsset.create({
    data: {
      publicId: input.publicId,
      secureUrl: input.secureUrl,
      type: input.resourceType === "image" ? "IMAGE" : "VIDEO",
      folder: EXPECTED_FOLDER,
      altText: input.altText,
      metadata: { width: input.width, height: input.height, bytes: input.bytes, format: input.format.toLowerCase() },
    },
  });
  await audit({ adminUserId, action: "SITE_ASSET_UPLOADED", entityType: "MediaAsset", entityId: asset.id, after: asset });
  return { ...asset, width: input.width, height: input.height };
}
