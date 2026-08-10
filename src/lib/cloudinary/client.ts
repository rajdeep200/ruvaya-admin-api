import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/config/env";
import { ApiError } from "@/lib/http/api";
import { safeEqual } from "@/lib/security/crypto";

function configured() {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  )
    throw new ApiError("NOT_CONFIGURED", "Cloudinary is not configured", 503);
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
}

export function productUploadSignature(
  productId: string,
  resourceType: "image" | "video",
) {
  const config = configured();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `ruvaya/products/${productId}`;
  const params = {
    timestamp,
    folder,
    overwrite: false,
    unique_filename: true,
    use_filename: false,
  };
  return {
    ...params,
    resourceType,
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    signature: cloudinary.utils.api_sign_request(params, config.apiSecret),
  };
}

export function siteAssetUploadSignature(resourceType: "image" | "video") {
  const config = configured();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "ruvaya/site-assets";
  const params = {
    timestamp,
    folder,
    overwrite: false,
    unique_filename: true,
    use_filename: false,
  };
  return {
    ...params,
    resourceType,
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    signature: cloudinary.utils.api_sign_request(params, config.apiSecret),
  };
}

export function reviewMediaUploadSignature(resourceType: "image" | "video") {
  const config = configured();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "ruvaya/reviews";
  const params = {
    timestamp,
    folder,
    overwrite: false,
    unique_filename: true,
    use_filename: false,
  };
  return {
    ...params,
    resourceType,
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    signature: cloudinary.utils.api_sign_request(params, config.apiSecret),
  };
}

export function verifyUploadResponse(
  publicId: string,
  version: number,
  signature: string,
) {
  const { apiSecret } = configured();
  const expected = cloudinary.utils.api_sign_request(
    { public_id: publicId, version },
    apiSecret,
  );
  return safeEqual(expected, signature);
}

export async function getCloudinaryResource(
  publicId: string,
  resourceType: "image" | "video",
) {
  configured();
  return cloudinary.api.resource(publicId, { resource_type: resourceType });
}

export async function destroyCloudinaryResource(
  publicId: string,
  resourceType: "image" | "video",
) {
  configured();
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
}
