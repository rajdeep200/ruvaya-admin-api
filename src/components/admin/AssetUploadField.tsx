"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { api } from "@/lib/admin/api-client";

export type UploadedImage = { url: string; width: number; height: number; alt: string; publicId?: string };

type Props = {
  label: string;
  value: UploadedImage | null;
  onChange: (image: UploadedImage | null) => void;
  signatureEndpoint?: string;
  confirmEndpoint?: string;
};

export function AssetUploadField({
  label,
  value,
  onChange,
  signatureEndpoint = "/api/v1/admin/media-assets/upload-signature",
  confirmEndpoint = "/api/v1/admin/media-assets/confirm",
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp|avif)$/)) {
      setError("Unsupported file type — use JPG, PNG, WebP or AVIF");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds 25 MB");
      return;
    }
    setError("");
    setProgress(0);
    try {
      const signed = await api(signatureEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceType: "image" }),
      });
      const form = new FormData();
      form.append("file", file);
      for (const key of ["apiKey", "timestamp", "signature", "folder", "overwrite", "unique_filename", "use_filename"]) {
        const cloudKey = key === "apiKey" ? "api_key" : key;
        form.append(cloudKey, String(signed[key]));
      }
      const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded * 100) / event.total));
        };
        xhr.onerror = () => reject(new Error("Network error while uploading"));
        xhr.onload = () => {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(body);
          else reject(new Error(body.error?.message ?? "Upload failed"));
        };
        xhr.send(form);
      });
      const confirmed = await api(confirmEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          version: result.version,
          signature: result.signature,
          resourceType: result.resource_type,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          folder: signed.folder,
          altText: value?.alt ?? "",
        }),
      });
      onChange({
        url: confirmed.secureUrl,
        width: confirmed.width,
        height: confirmed.height,
        alt: confirmed.altText ?? "",
        publicId: confirmed.publicId as string,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="field">
      <span>{label}</span>
      {value ? (
        <div className="media-card" style={{ maxWidth: 220 }}>
          <Image
            src={value.url}
            alt={value.alt || label}
            width={220}
            height={Math.round((220 * value.height) / value.width) || 220}
          />
          <div className="media-card-body">
            <input
              placeholder="Alt text"
              value={value.alt}
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
            />
            <div className="row-actions">
              <button type="button" onClick={() => fileInput.current?.click()}>
                Replace
              </button>
              <button type="button" className="text-danger" onClick={() => onChange(null)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="dropzone" onClick={() => fileInput.current?.click()}>
          <strong>{progress != null ? `Uploading… ${progress}%` : "Click to upload an image"}</strong>
        </div>
      )}
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
      />
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}
