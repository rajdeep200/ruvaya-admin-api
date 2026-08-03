"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { slugify, paise } from "@/lib/admin/product-form-utils";
import { api, ApiRequestError } from "@/lib/admin/api-client";
import { SIZES, FABRICS } from "@/components/admin/ProductEditor";

type Media = {
  id: string;
  secureUrl: string;
  altText: string;
  type: "IMAGE" | "VIDEO";
  isPrimary: boolean;
  uploadStatus: string;
};
type Variant = {
  sku: string;
  color: string;
  colorLabel: string;
  colorHex: string | null;
  size: string;
  position: number;
  regularPricePaise: null;
  salePricePaise: null;
  costPricePaise: null;
  openingStock: number;
  lowStockThreshold: number;
  active: boolean;
  weightGrams: null;
  mediaId: null;
};
type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "failed" | "done";
  error?: string;
  xhr?: XMLHttpRequest;
};

const CATEGORIES = ["Kurti", "Kurti Set", "Co-ord Set", "Dupatta Set"];
const CATEGORY_PREFIX: Record<string, string> = {
  Kurti: "KUR",
  "Kurti Set": "KST",
  "Co-ord Set": "COS",
  "Dupatta Set": "DUP",
};
const DEFAULT_COLOR = { id: "default", label: "Default", hex: "#8b6755" };
const STEP_TITLES = [
  "What are you selling?",
  "Add photos",
  "Price & stock",
  "Review & publish",
];
const randomSuffix = (length: number) =>
  Math.random().toString(36).slice(2, 2 + length);

function buildVariant(
  color: { id: string; label: string; hex: string },
  size: string,
  internalCode: string,
  existing?: Variant,
): Variant {
  if (existing) return existing;
  return {
    sku: [
      internalCode,
      color.id !== "default" ? color.id.slice(0, 3).toUpperCase() : "",
      size !== "One Size" ? size : "",
    ]
      .filter(Boolean)
      .join("-"),
    color: color.id,
    colorLabel: color.label,
    colorHex: color.hex,
    size,
    position: 0,
    regularPricePaise: null,
    salePricePaise: null,
    costPricePaise: null,
    openingStock: 0,
    lowStockThreshold: 3,
    active: true,
    weightGrams: null,
    mediaId: null,
  };
}

export function ProductWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState("");
  const [slug, setSlug] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [fabric, setFabric] = useState(FABRICS[0]);
  const [description, setDescription] = useState("");
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  const [hasSizes, setHasSizes] = useState(false);
  const [hasColors, setHasColors] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["M"]);
  const [selectedColors, setSelectedColors] = useState([DEFAULT_COLOR]);
  const [variants, setVariants] = useState<Variant[]>([
    buildVariant(DEFAULT_COLOR, "One Size", ""),
  ]);

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);

  const pricing = useMemo(() => {
    try {
      const mrp = regularPrice ? paise(regularPrice, "Regular price") : 0,
        sale = salePrice ? paise(salePrice, "Sale price") : mrp;
      return {
        discountPct: mrp ? Math.round(((mrp - sale) * 100) / mrp) : 0,
      };
    } catch {
      return { discountPct: 0 };
    }
  }, [regularPrice, salePrice]);

  function regenerateVariants(
    nextSizes = selectedSizes,
    nextColors = selectedColors,
    nextHasSizes = hasSizes,
    nextHasColors = hasColors,
  ) {
    const sizes = nextHasSizes ? nextSizes : ["One Size"],
      colors = nextHasColors ? nextColors : [DEFAULT_COLOR];
    setVariants((current) => {
      const map = new Map(current.map((v) => [`${v.color}|${v.size}`, v]));
      return colors
        .flatMap((color) =>
          sizes.map((size) =>
            buildVariant(
              color,
              size,
              internalCode,
              map.get(`${color.id}|${size}`),
            ),
          ),
        )
        .map((v, position) => ({ ...v, position }));
    });
    setDirty(true);
  }
  const patchStock = (index: number, openingStock: number) => {
    setVariants((rows) =>
      rows.map((row, i) => (i === index ? { ...row, openingStock } : row)),
    );
    setDirty(true);
  };

  async function ensureDraft() {
    if (productId) return productId;
    const baseSlug = slugify(name),
      baseCode = `${CATEGORY_PREFIX[category] ?? "PRD"}-${randomSuffix(5).toUpperCase()}`;
    try {
      const draft = await api("/api/v1/admin/products/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          slug: baseSlug,
          internalCode: baseCode,
          category,
        }),
      });
      setProductId(draft.id);
      setSlug(baseSlug);
      setInternalCode(baseCode);
      regenerateVariantsWithCode(baseCode);
      return draft.id as string;
    } catch {
      const retrySlug = `${baseSlug}-${randomSuffix(4)}`,
        retryCode = `${baseCode}${randomSuffix(2).toUpperCase()}`;
      const draft = await api("/api/v1/admin/products/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          slug: retrySlug,
          internalCode: retryCode,
          category,
        }),
      });
      setProductId(draft.id);
      setSlug(retrySlug);
      setInternalCode(retryCode);
      regenerateVariantsWithCode(retryCode);
      return draft.id as string;
    }
  }
  function regenerateVariantsWithCode(code: string) {
    setVariants((current) =>
      current.map((v) => ({
        ...v,
        sku: [
          code,
          v.color !== "default" ? v.color.slice(0, 3).toUpperCase() : "",
          v.size !== "One Size" ? v.size : "",
        ]
          .filter(Boolean)
          .join("-"),
      })),
    );
  }

  async function goToPhotos() {
    setError("");
    if (name.trim().length < 2) {
      setError("Please enter a product name.");
      return;
    }
    if (description.trim().length < 1) {
      setError("Please add a short description.");
      return;
    }
    setBusy("creating");
    try {
      await ensureDraft();
      setStep(2);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start the product",
      );
    } finally {
      setBusy("");
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const uploadId = crypto.randomUUID();
      if (
        !file.type.match(/^(image\/(jpeg|png|webp|avif)|video\/(mp4|webm))$/)
      ) {
        setUploads((rows) => [
          ...rows,
          {
            id: uploadId,
            name: file.name,
            progress: 0,
            status: "failed",
            error: "Unsupported file type",
          },
        ]);
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        setUploads((rows) => [
          ...rows,
          {
            id: uploadId,
            name: file.name,
            progress: 0,
            status: "failed",
            error: "File exceeds 25 MB",
          },
        ]);
        continue;
      }
      const resourceType = file.type.startsWith("video/") ? "video" : "image";
      setUploads((rows) => [
        ...rows,
        { id: uploadId, name: file.name, progress: 0, status: "uploading" },
      ]);
      try {
        const signed = await api("/api/v1/admin/media/upload-signature", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId, resourceType }),
        });
        const form = new FormData();
        form.append("file", file);
        for (const key of [
          "apiKey",
          "timestamp",
          "signature",
          "folder",
          "overwrite",
          "unique_filename",
          "use_filename",
        ]) {
          const cloudKey = key === "apiKey" ? "api_key" : key;
          form.append(cloudKey, String(signed[key]));
        }
        const result = await new Promise<Record<string, unknown>>(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest();
            setUploads((rows) =>
              rows.map((row) => (row.id === uploadId ? { ...row, xhr } : row)),
            );
            xhr.open(
              "POST",
              `https://api.cloudinary.com/v1_1/${signed.cloudName}/${resourceType}/upload`,
            );
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable)
                setUploads((rows) =>
                  rows.map((row) =>
                    row.id === uploadId
                      ? {
                          ...row,
                          progress: Math.round(
                            (event.loaded * 100) / event.total,
                          ),
                        }
                      : row,
                  ),
                );
            };
            xhr.onerror = () =>
              reject(new Error("Network error while uploading"));
            xhr.onload = () => {
              const body = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) resolve(body);
              else
                reject(
                  new Error(body.error?.message ?? "Upload failed"),
                );
            };
            xhr.send(form);
          },
        );
        const confirmed = await api("/api/v1/admin/media/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productId,
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
            altText: name,
            mimeType: file.type,
          }),
        });
        setMedia((rows) => [...rows, confirmed]);
        setUploads((rows) =>
          rows.map((row) =>
            row.id === uploadId
              ? { ...row, status: "done", progress: 100, xhr: undefined }
              : row,
          ),
        );
      } catch (cause) {
        setUploads((rows) =>
          rows.map((row) =>
            row.id === uploadId
              ? {
                  ...row,
                  status: "failed",
                  error:
                    cause instanceof Error ? cause.message : "Upload failed",
                  xhr: undefined,
                }
              : row,
          ),
        );
      }
    }
  }
  async function primary(id: string) {
    try {
      const updated = await api(`/api/v1/admin/media/${id}/set-primary`, {
        method: "POST",
      });
      setMedia((rows) =>
        rows.map((row) => ({ ...row, isPrimary: row.id === updated.id })),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not set the main photo",
      );
    }
  }
  async function removeMedia(id: string) {
    if (!window.confirm("Remove this photo?")) return;
    try {
      await api(`/api/v1/admin/media/${id}`, { method: "DELETE" });
      setMedia((rows) => rows.filter((row) => row.id !== id));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not remove the photo",
      );
    }
  }

  function goToPrice() {
    setError("");
    setStep(3);
  }
  function goToReview() {
    setError("");
    try {
      if (!regularPrice || paise(regularPrice, "Price") <= 0) {
        setError("Please enter a price.");
        return;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please enter a valid price.");
      return;
    }
    setStep(4);
  }

  function payload(statusActive: boolean) {
    return {
      name,
      slug,
      internalCode,
      shortDescription: description.slice(0, 500),
      fullDescription: description,
      category,
      active: statusActive,
      regularPricePaise: paise(regularPrice, "Regular price"),
      salePricePaise: salePrice ? paise(salePrice, "Sale price") : null,
      costPricePaise: null,
      taxInclusive: true,
      fabric,
      fit: "Regular fit",
      pattern: "Solid",
      occasions: [] as string[],
      primaryColor: null,
      neckType: "Round neck",
      sleeveType: "Three-quarter sleeve",
      kurtiLength: null,
      transparency: null,
      lining: null,
      sideSlit: null,
      washCare: [] as string[],
      modelHeightCm: null,
      modelSizeWorn: null,
      fitIndicator: "True to size",
      fitNote: null,
      countryOfOrigin: "India",
      packageContents: null,
      featured: false,
      bestseller: false,
      newArrival: false,
      badge: null,
      sortPriority: 0,
      publishStartAt: null,
      publishEndAt: null,
      seoTitle: null,
      seoDescription: null,
      searchKeywords: [] as string[],
      searchVisible: true,
      indexable: true,
      shippingInfo: "Use store default",
      dispatchDays: null,
      weightGrams: null,
      returnEligible: true,
      returnWindowDays: 7,
      cancellationEligible: true,
      codAvailableOverride: null,
      variants,
      measurements: [] as unknown[],
      collectionIds: [] as string[],
      sources: [] as unknown[],
    };
  }

  async function saveForLater() {
    setBusy("save");
    setError("");
    try {
      const id = productId || (await ensureDraft());
      await api(`/api/v1/admin/products/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload(true)),
      });
      setDirty(false);
      router.push(`/admin/products/${id}/edit`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the product",
      );
    } finally {
      setBusy("");
    }
  }

  const PLAIN_FAILURES: Record<string, string> = {
    "Basic information is incomplete": "Product name is missing",
    "Pricing is invalid": "The price needs to be fixed",
    "Attributes and shipping information are required":
      "Some product details are missing",
    "At least one active variant is required":
      "At least one size/colour needs to be set up",
    "Inventory configuration is invalid": "Stock quantities look incorrect",
    "A confirmed primary image is required":
      "Please add a photo and mark one as the main photo",
  };

  async function publishNow() {
    setBusy("publish");
    setError("");
    setChecklist([]);
    try {
      const id = productId || (await ensureDraft());
      await api(`/api/v1/admin/products/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload(true)),
      });
      await api(`/api/v1/admin/products/${id}/publish`, { method: "POST" });
      setDirty(false);
      router.push("/admin/products");
    } catch (cause) {
      const failures =
        cause instanceof ApiRequestError &&
        cause.details &&
        typeof cause.details === "object" &&
        Array.isArray((cause.details as { failures?: unknown }).failures)
          ? ((cause.details as { failures: string[] }).failures)
          : null;
      if (failures) {
        setChecklist(failures.map((f) => PLAIN_FAILURES[f] ?? f));
        setError("This product isn't ready to publish yet.");
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not publish the product",
        );
      }
    } finally {
      setBusy("");
    }
  }

  const primaryImage = media.find((m) => m.isPrimary);

  return (
    <div className="product-wizard card">
      <div className="wizard-progress">
        {STEP_TITLES.map((title, index) => (
          <div
            key={title}
            className={`wizard-step ${index + 1 === step ? "active" : ""} ${
              index + 1 < step ? "done" : ""
            }`}
          >
            <span className="wizard-step-number">{index + 1}</span>
            <span className="wizard-step-title">{title}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="error-summary" role="alert">
          <strong>Something needs attention</strong>
          <p>{error}</p>
          {checklist.length > 0 && (
            <ul>
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="form-grid">
          <label className="field wide">
            Product name
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              placeholder="e.g. Floral Cotton Kurti"
            />
          </label>
          <label className="field">
            Product type
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setDirty(true);
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Fabric
            <select
              value={fabric}
              onChange={(e) => {
                setFabric(e.target.value);
                setDirty(true);
              }}
            >
              {FABRICS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="field wide">
            Describe the product
            <textarea
              rows={5}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
              placeholder="What should customers know about this product?"
            />
          </label>
          <div className="wizard-nav">
            <a href="/admin/products/new-advanced" className="muted">
              Need every field? Use the advanced form
            </a>
            <button
              type="button"
              className="btn"
              disabled={Boolean(busy)}
              onClick={goToPhotos}
            >
              {busy === "creating" ? "Starting…" : "Next: Add photos"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void uploadFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
          >
            <input
              ref={fileInput}
              hidden
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
              onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
            />
            <strong>Drop photos here</strong>
            <span>or choose files · JPG, PNG, WebP, MP4 · maximum 25 MB</span>
          </div>
          {uploads
            .filter((u) => u.status !== "done")
            .map((item) => (
              <div key={item.id} className="upload-list">
                <span>{item.name}</span>
                <progress value={item.progress} max={100} />
                <span>
                  {item.status}
                  {item.error ? `: ${item.error}` : ""}
                </span>
              </div>
            ))}
          {media.length === 0 ? (
            <div className="empty-state">No photos yet.</div>
          ) : (
            <div className="media-grid">
              {media.map((item) => (
                <article
                  key={item.id}
                  className={`media-card ${item.isPrimary ? "primary" : ""}`}
                >
                  {item.type === "IMAGE" ? (
                    <Image
                      src={item.secureUrl}
                      alt={item.altText}
                      width={240}
                      height={300}
                    />
                  ) : (
                    <video controls src={item.secureUrl} />
                  )}
                  <div className="media-card-body">
                    {item.isPrimary && (
                      <strong className="primary-label">Main photo</strong>
                    )}
                    <div className="row-actions">
                      {!item.isPrimary && item.type === "IMAGE" && (
                        <button type="button" onClick={() => void primary(item.id)}>
                          Set as main photo
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-danger"
                        onClick={() => void removeMedia(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="wizard-nav">
            <button type="button" className="btn secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn" onClick={goToPrice}>
              Next: Price & stock
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="form-grid">
            <label className="field">
              Price (₹)
              <input
                inputMode="decimal"
                value={regularPrice}
                onChange={(e) => {
                  setRegularPrice(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label className="field">
              Sale price (₹) — only if discounted
              <input
                inputMode="decimal"
                value={salePrice}
                onChange={(e) => {
                  setSalePrice(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
          </div>
          {pricing.discountPct > 0 && (
            <p className="muted">Discount: {pricing.discountPct}%</p>
          )}
          <div className="toggle-row">
            <label className="check">
              <input
                type="checkbox"
                checked={hasSizes}
                onChange={(e) => {
                  setHasSizes(e.target.checked);
                  regenerateVariants(selectedSizes, selectedColors, e.target.checked, hasColors);
                }}
              />
              <span>Comes in different sizes</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={hasColors}
                onChange={(e) => {
                  setHasColors(e.target.checked);
                  regenerateVariants(selectedSizes, selectedColors, hasSizes, e.target.checked);
                }}
              />
              <span>Comes in different colours</span>
            </label>
          </div>
          {hasSizes && (
            <div className="choice-list">
              {SIZES.map((size) => (
                <label key={size}>
                  <input
                    type="checkbox"
                    checked={selectedSizes.includes(size)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selectedSizes, size]
                        : selectedSizes.filter((x) => x !== size);
                      setSelectedSizes(next);
                      regenerateVariants(next);
                    }}
                  />
                  {size}
                </label>
              ))}
            </div>
          )}
          {hasColors && (
            <div className="color-list">
              {selectedColors.map((color, index) => (
                <div key={color.id}>
                  <input
                    aria-label="Colour name"
                    value={color.label}
                    onChange={(e) => {
                      const next = selectedColors.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              label: e.target.value,
                              id: slugify(e.target.value) || row.id,
                            }
                          : row,
                      );
                      setSelectedColors(next);
                      regenerateVariants(selectedSizes, next);
                    }}
                  />
                  <input
                    aria-label="Colour"
                    type="color"
                    value={color.hex}
                    onChange={(e) => {
                      const next = selectedColors.map((row, i) =>
                        i === index ? { ...row, hex: e.target.value } : row,
                      );
                      setSelectedColors(next);
                      regenerateVariants(selectedSizes, next);
                    }}
                  />
                  <button
                    type="button"
                    disabled={selectedColors.length === 1}
                    onClick={() => {
                      const next = selectedColors.filter((_, i) => i !== index);
                      setSelectedColors(next);
                      regenerateVariants(selectedSizes, next);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const label = prompt("Colour name");
                  if (label) {
                    const next = [
                      ...selectedColors,
                      { id: slugify(label), label, hex: "#8b6755" },
                    ];
                    setSelectedColors(next);
                    regenerateVariants(selectedSizes, next);
                  }
                }}
              >
                Add colour
              </button>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Colour</th>
                  <th>Size</th>
                  <th>Stock quantity</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant, index) => (
                  <tr key={`${variant.color}-${variant.size}`}>
                    <td>{variant.colorLabel}</td>
                    <td>{variant.size}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={variant.openingStock}
                        onChange={(e) =>
                          patchStock(index, Number(e.target.value))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wizard-nav">
            <button type="button" className="btn secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="btn" onClick={goToReview}>
              Next: Review
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="grid">
            <div className="card metric">
              Photos
              <strong>
                {media.length} {primaryImage ? "(main photo set)" : "(no main photo yet)"}
              </strong>
            </div>
            <div className="card metric">
              Price
              <strong>
                ₹{regularPrice || "0"}
                {pricing.discountPct > 0 ? ` (${pricing.discountPct}% off)` : ""}
              </strong>
            </div>
            <div className="card metric">
              Variants
              <strong>{variants.length}</strong>
            </div>
            <div className="card metric">
              Total stock
              <strong>
                {variants.reduce((sum, v) => sum + v.openingStock, 0)}
              </strong>
            </div>
          </div>
          <ul className="readiness">
            <li className={name.trim().length >= 2 ? "ready" : "not-ready"}>
              {name.trim().length >= 2 ? "✓" : "○"} Product name is set
            </li>
            <li className={Number(regularPrice) > 0 ? "ready" : "not-ready"}>
              {Number(regularPrice) > 0 ? "✓" : "○"} Price is set
            </li>
            <li className={variants.length > 0 ? "ready" : "not-ready"}>
              {variants.length > 0 ? "✓" : "○"} At least one size/colour is set up
            </li>
            <li className={primaryImage ? "ready" : "not-ready"}>
              {primaryImage ? "✓" : "○"} A main photo is chosen
            </li>
          </ul>
          <div className="wizard-nav">
            <button type="button" className="btn secondary" onClick={() => setStep(3)}>
              Back
            </button>
            <div className="wizard-nav-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={Boolean(busy)}
                onClick={saveForLater}
              >
                {busy === "save" ? "Saving…" : "Save for later"}
              </button>
              <button
                type="button"
                className="btn"
                disabled={Boolean(busy)}
                onClick={publishNow}
              >
                {busy === "publish" ? "Publishing…" : "Publish now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
