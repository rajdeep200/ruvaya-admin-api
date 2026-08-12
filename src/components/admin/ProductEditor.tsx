"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { slugify, rupees, paise } from "@/lib/admin/product-form-utils";
import { api, ApiRequestError } from "@/lib/admin/api-client";

type CollectionOption = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  publishedAt: string | null;
};
type Media = {
  id: string;
  secureUrl: string;
  altText: string;
  position: number;
  isPrimary: boolean;
  color: string | null;
  assignedVariantId: string | null;
  type: "IMAGE" | "VIDEO";
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string;
  uploadStatus: string;
};
type Variant = {
  id?: string;
  sku: string;
  color: string;
  colorLabel: string;
  colorHex: string | null;
  size: string;
  position: number;
  regularPricePaise: number | null;
  salePricePaise: number | null;
  costPricePaise: number | null;
  currentStock?: number;
  openingStock: number;
  reservedStock?: number;
  lowStockThreshold: number;
  active: boolean;
  weightGrams: number | null;
  mediaId: string | null;
};
type Measurement = {
  size: string;
  bustTenthsIn: number;
  waistTenthsIn: number;
  hipTenthsIn: number;
  shoulderTenthsIn: number | null;
  lengthTenthsIn: number;
  sleeveTenthsIn: number | null;
};
type Source = {
  id?: string;
  platform: string;
  supplierName: string;
  supplierUrl: string;
  sourceListingId: string;
  sourceSku: string;
  sourcePricePaise: number | null;
  availabilityState: string;
  expectedDeliveryDays: number | null;
  notes: string;
  backupSource: boolean;
  active: boolean;
  variantMapping: Record<string, string>;
  lastCheckedAt: string | null;
};
type InitialProduct = {
  id: string;
  name: string;
  slug: string;
  internalCode: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  status: string;
  active: boolean;
  regularPricePaise: number;
  salePricePaise: number | null;
  costPricePaise: number | null;
  taxInclusive: boolean;
  fabric: string;
  fit: string | null;
  pattern: string | null;
  occasions: string[];
  primaryColor: string | null;
  neckType: string | null;
  sleeveType: string | null;
  kurtiLength: string | null;
  transparency: string | null;
  lining: string | null;
  sideSlit: string | null;
  washCare: string[];
  modelHeightCm: number | null;
  modelSizeWorn: string | null;
  fitIndicator: string | null;
  fitNote: string | null;
  countryOfOrigin: string | null;
  packageContents: string | null;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  badge: string | null;
  sortPriority: number;
  publishStartAt: string | null;
  publishEndAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  searchKeywords: string[];
  searchVisible: boolean;
  indexable: boolean;
  shippingInfo: string;
  dispatchDays: number | null;
  weightGrams: number | null;
  returnEligible: boolean;
  returnWindowDays: number | null;
  cancellationEligible: boolean;
  codAvailableOverride: boolean | null;
  variants: Array<
    Omit<Variant, "openingStock"> & {
      currentStock: number;
      reservedStock: number;
    }
  >;
  media: Media[];
  measurements: Measurement[];
  collections: { collectionId: string }[];
  sources: Source[];
};
type Props = {
  initialProduct?: InitialProduct;
  collections: CollectionOption[];
};
type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "failed" | "done" | "cancelled";
  error?: string;
  xhr?: XMLHttpRequest;
  file?: File;
};

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
export const FABRICS = [
  "Cotton",
  "Rayon",
  "Viscose",
  "Linen",
  "Georgette",
  "Silk blend",
  "Other",
];
const FITS = [
  "Regular fit",
  "Straight fit",
  "A-line",
  "Flared",
  "Relaxed fit",
  "Slim fit",
  "Other",
];
const PATTERNS = [
  "Printed",
  "Solid",
  "Embroidered",
  "Floral",
  "Block print",
  "Chikankari",
  "Other",
];
const OCCASIONS = [
  "Everyday",
  "Casual",
  "Office wear",
  "Festive",
  "Party wear",
  "Other",
];
const NECKS = [
  "Round neck",
  "V-neck",
  "Mandarin collar",
  "Square neck",
  "Boat neck",
  "Other",
];
const SLEEVES = [
  "Sleeveless",
  "Short sleeve",
  "Three-quarter sleeve",
  "Full sleeve",
  "Other",
];

function describeError(cause: unknown, fallback: string): string {
  if (
    cause instanceof ApiRequestError &&
    Array.isArray(cause.details) &&
    cause.details.every(
      (d): d is { path: string; message: string } =>
        typeof d === "object" &&
        d !== null &&
        typeof (d as { path?: unknown }).path === "string" &&
        typeof (d as { message?: unknown }).message === "string",
    ) &&
    cause.details.length
  )
    return cause.details.map((d) => `${d.path}: ${d.message}`).join("; ");
  return cause instanceof Error ? cause.message : fallback;
}

export function ProductEditor({ initialProduct, collections }: Props) {
  const router = useRouter();
  const [productId, setProductId] = useState(initialProduct?.id ?? "");
  const [status, setStatus] = useState(initialProduct?.status ?? "DRAFT");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(initialProduct));
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [media, setMedia] = useState<Media[]>(initialProduct?.media ?? []);
  const [draggedMedia, setDraggedMedia] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const [hasSizes, setHasSizes] = useState(
    initialProduct
      ? new Set(initialProduct.variants.map((v) => v.size)).size > 1 ||
          initialProduct.variants[0]?.size !== "One Size"
      : false,
  );
  const [hasColors, setHasColors] = useState(
    initialProduct
      ? new Set(initialProduct.variants.map((v) => v.color)).size > 1 ||
          initialProduct.variants[0]?.color !== "default"
      : false,
  );
  const [selectedSizes, setSelectedSizes] = useState<string[]>(
    initialProduct
      ? [...new Set(initialProduct.variants.map((v) => v.size))]
      : ["M"],
  );
  const [selectedColors, setSelectedColors] = useState<
    Array<{ id: string; label: string; hex: string }>
  >(
    initialProduct
      ? [
          ...new Map(
            initialProduct.variants.map((v) => [
              v.color,
              {
                id: v.color,
                label: v.colorLabel,
                hex: v.colorHex ?? "#8b6755",
              },
            ]),
          ).values(),
        ]
      : [{ id: "default", label: "Default", hex: "#8b6755" }],
  );
  const [variants, setVariants] = useState<Variant[]>(
    initialProduct?.variants.map((v) => ({
      ...v,
      openingStock: v.currentStock,
    })) ?? [
      {
        sku: "",
        color: "default",
        colorLabel: "Default",
        colorHex: "#8b6755",
        size: "One Size",
        position: 0,
        regularPricePaise: null,
        salePricePaise: null,
        costPricePaise: null,
        openingStock: 0,
        reservedStock: 0,
        lowStockThreshold: 3,
        active: true,
        weightGrams: null,
        mediaId: null,
      },
    ],
  );
  const [measurements, setMeasurements] = useState<Measurement[]>(
    initialProduct?.measurements ?? [],
  );
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    initialProduct?.collections.map((c) => c.collectionId) ?? [],
  );
  const [sources, setSources] = useState<Source[]>(
    initialProduct?.sources ?? [],
  );
  const [f, setF] = useState({
    name: initialProduct?.name ?? "",
    slug: initialProduct?.slug ?? "",
    internalCode: initialProduct?.internalCode ?? "",
    category: initialProduct?.category ?? "Kurti",
    shortDescription: initialProduct?.shortDescription ?? "",
    fullDescription: initialProduct?.fullDescription ?? "",
    regularPrice: rupees(initialProduct?.regularPricePaise),
    salePrice: rupees(initialProduct?.salePricePaise),
    costPrice: rupees(initialProduct?.costPricePaise),
    taxInclusive: initialProduct?.taxInclusive ?? true,
    fabric: initialProduct?.fabric ?? "Cotton",
    fit: initialProduct?.fit ?? "Regular fit",
    pattern: initialProduct?.pattern ?? "Solid",
    occasions: initialProduct?.occasions ?? [],
    primaryColor: initialProduct?.primaryColor ?? "",
    neckType: initialProduct?.neckType ?? "Round neck",
    sleeveType: initialProduct?.sleeveType ?? "Three-quarter sleeve",
    kurtiLength: initialProduct?.kurtiLength ?? "",
    transparency: initialProduct?.transparency ?? "",
    lining: initialProduct?.lining ?? "",
    sideSlit: initialProduct?.sideSlit ?? "",
    washCare: (initialProduct?.washCare ?? []).join(", "),
    modelHeightCm: String(initialProduct?.modelHeightCm ?? ""),
    modelSizeWorn: initialProduct?.modelSizeWorn ?? "",
    fitIndicator: initialProduct?.fitIndicator ?? "True to size",
    fitNote: initialProduct?.fitNote ?? "",
    countryOfOrigin: initialProduct?.countryOfOrigin ?? "India",
    packageContents: initialProduct?.packageContents ?? "",
    featured: initialProduct?.featured ?? false,
    bestseller: initialProduct?.bestseller ?? false,
    newArrival: initialProduct?.newArrival ?? false,
    badge: initialProduct?.badge ?? "",
    sortPriority: String(initialProduct?.sortPriority ?? 0),
    publishStartAt: initialProduct?.publishStartAt?.slice(0, 16) ?? "",
    publishEndAt: initialProduct?.publishEndAt?.slice(0, 16) ?? "",
    seoTitle: initialProduct?.seoTitle ?? "",
    seoDescription: initialProduct?.seoDescription ?? "",
    searchKeywords: (initialProduct?.searchKeywords ?? []).join(", "),
    searchVisible: initialProduct?.searchVisible ?? true,
    indexable: initialProduct?.indexable ?? true,
    shippingInfo: initialProduct?.shippingInfo ?? "Use store default",
    dispatchDays: String(initialProduct?.dispatchDays ?? ""),
    weightGrams: String(initialProduct?.weightGrams ?? ""),
    returnEligible: initialProduct?.returnEligible ?? true,
    returnWindowDays: String(initialProduct?.returnWindowDays ?? 7),
    cancellationEligible: initialProduct?.cancellationEligible ?? true,
    codAvailableOverride:
      initialProduct?.codAvailableOverride == null
        ? "default"
        : String(initialProduct.codAvailableOverride),
    active: initialProduct?.active ?? true,
  });

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
  const update = (key: keyof typeof f, value: string | boolean) => {
    setF((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !slugEdited) next.slug = slugify(String(value));
      return next;
    });
    setDirty(true);
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  };
  const pricing = useMemo(() => {
    try {
      const mrp = f.regularPrice ? paise(f.regularPrice, "Regular price") : 0,
        sale = f.salePrice ? paise(f.salePrice, "Sale price") : mrp,
        cost = f.costPrice ? paise(f.costPrice, "Cost price") : 0;
      return {
        discount: (mrp - sale) / 100,
        discountPct: mrp ? Math.round(((mrp - sale) * 100) / mrp) : 0,
        margin: (sale - cost) / 100,
        marginPct: sale ? Math.round(((sale - cost) * 100) / sale) : 0,
      };
    } catch {
      return { discount: 0, discountPct: 0, margin: 0, marginPct: 0 };
    }
  }, [f.regularPrice, f.salePrice, f.costPrice]);

  function payload() {
    return {
      name: f.name,
      slug: f.slug,
      internalCode: f.internalCode,
      shortDescription: f.shortDescription,
      fullDescription: f.fullDescription,
      category: f.category,
      active: f.active,
      regularPricePaise: paise(f.regularPrice, "Regular price"),
      salePricePaise: f.salePrice ? paise(f.salePrice, "Sale price") : null,
      costPricePaise: f.costPrice ? paise(f.costPrice, "Cost price") : null,
      taxInclusive: f.taxInclusive,
      fabric: f.fabric,
      fit: f.fit || null,
      pattern: f.pattern || null,
      occasions: f.occasions,
      primaryColor: f.primaryColor || null,
      neckType: f.neckType || null,
      sleeveType: f.sleeveType || null,
      kurtiLength: f.kurtiLength || null,
      transparency: f.transparency || null,
      lining: f.lining || null,
      sideSlit: f.sideSlit || null,
      washCare: f.washCare
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      modelHeightCm: f.modelHeightCm ? Number(f.modelHeightCm) : null,
      modelSizeWorn: f.modelSizeWorn || null,
      fitIndicator: f.fitIndicator || null,
      fitNote: f.fitNote || null,
      countryOfOrigin: f.countryOfOrigin || null,
      packageContents: f.packageContents || null,
      featured: f.featured,
      bestseller: f.bestseller,
      newArrival: f.newArrival,
      badge: f.badge || null,
      sortPriority: Number(f.sortPriority) || 0,
      publishStartAt: f.publishStartAt
        ? new Date(f.publishStartAt).toISOString()
        : null,
      publishEndAt: f.publishEndAt
        ? new Date(f.publishEndAt).toISOString()
        : null,
      seoTitle: f.seoTitle || null,
      seoDescription: f.seoDescription || null,
      searchKeywords: f.searchKeywords
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      searchVisible: f.searchVisible,
      indexable: f.indexable,
      shippingInfo: f.shippingInfo,
      dispatchDays: f.dispatchDays ? Number(f.dispatchDays) : null,
      weightGrams: f.weightGrams ? Number(f.weightGrams) : null,
      returnEligible: f.returnEligible,
      returnWindowDays: f.returnWindowDays ? Number(f.returnWindowDays) : null,
      cancellationEligible: f.cancellationEligible,
      codAvailableOverride:
        f.codAvailableOverride === "default"
          ? null
          : f.codAvailableOverride === "true",
      variants,
      measurements,
      collectionIds: selectedCollections,
      sources,
    };
  }
  function validateBasics() {
    const errors: Record<string, string> = {};
    if (f.name.trim().length < 2) errors.name = "Enter a product name";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug))
      errors.slug = "Use lowercase letters, numbers and hyphens";
    if (f.internalCode.trim().length < 2)
      errors.internalCode = "Enter an internal code";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Complete the highlighted basic information first.");
      return false;
    }
    return true;
  }
  async function ensureDraft() {
    if (productId) return productId;
    if (!validateBasics())
      throw new Error("Create the basic product draft before uploading media");
    const draft = await api("/api/v1/admin/products/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: f.name,
        slug: f.slug,
        internalCode: f.internalCode,
        category: f.category,
      }),
    });
    setProductId(draft.id);
    history.replaceState(null, "", `/admin/products/${draft.id}/edit`);
    return draft.id as string;
  }

  function regenerateVariants(
    nextSizes = selectedSizes,
    nextColors = selectedColors,
    nextHasSizes = hasSizes,
    nextHasColors = hasColors,
  ) {
    const sizes = nextHasSizes ? nextSizes : ["One Size"],
      colors = nextHasColors
        ? nextColors
        : [{ id: "default", label: "Default", hex: "#8b6755" }];
    setVariants((current) => {
      const map = new Map(current.map((v) => [`${v.color}|${v.size}`, v]));
      return colors
        .flatMap((color) =>
          sizes.map(
            (size) =>
              map.get(`${color.id}|${size}`) ?? {
                sku: [
                  f.internalCode,
                  color.id !== "default"
                    ? color.id.slice(0, 3).toUpperCase()
                    : "",
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
                reservedStock: 0,
                lowStockThreshold: 3,
                active: true,
                weightGrams: null,
                mediaId: null,
              },
          ),
        )
        .map((v, position) => ({ ...v, position }));
    });
    setDirty(true);
  }
  const patchVariant = (index: number, patch: Partial<Variant>) => {
    setVariants((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  };
  function addMeasurement(size: string) {
    if (!size || measurements.some((row) => row.size === size)) return;
    setMeasurements((rows) => [
      ...rows,
      {
        size,
        bustTenthsIn: 360,
        waistTenthsIn: 320,
        hipTenthsIn: 400,
        shoulderTenthsIn: null,
        lengthTenthsIn: 440,
        sleeveTenthsIn: null,
      },
    ]);
    setDirty(true);
  }

  async function uploadFiles(files: FileList | File[]) {
    let id: string;
    try {
      id = await ensureDraft();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create draft",
      );
      return;
    }
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
            file,
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
            file,
          },
        ]);
        continue;
      }
      const resourceType = file.type.startsWith("video/") ? "video" : "image";
      setUploads((rows) => [
        ...rows,
        { id: uploadId, name: file.name, progress: 0, status: "uploading", file },
      ]);
      try {
        const signed = await api("/api/v1/admin/media/upload-signature", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId: id, resourceType }),
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
              else reject(new Error(body.error?.message ?? "Cloudinary upload failed"));
            };
            xhr.send(form);
          },
        );
        const confirmed = await api("/api/v1/admin/media/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productId: id,
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
            altText: f.name,
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
        if (replaceId.current) {
          const old = replaceId.current;
          replaceId.current = null;
          await removeMedia(old, false);
        }
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
  async function updateMedia(
    item: Media,
    patch: Partial<Pick<Media, "altText" | "color" | "assignedVariantId">>,
  ) {
    try {
      const updated = await api(`/api/v1/admin/media/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          altText: patch.altText ?? item.altText,
          color: patch.color === undefined ? item.color : patch.color,
          variantId:
            patch.assignedVariantId === undefined
              ? item.assignedVariantId
              : patch.assignedVariantId,
        }),
      });
      setMedia((rows) =>
        rows.map((row) => (row.id === item.id ? updated : row)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update media",
      );
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
        cause instanceof Error ? cause.message : "Could not set primary image",
      );
    }
  }
  async function removeMedia(id: string, confirmFirst = true) {
    if (
      confirmFirst &&
      !window.confirm("Delete this asset from Cloudinary and this product?")
    )
      return;
    try {
      await api(`/api/v1/admin/media/${id}`, { method: "DELETE" });
      setMedia((rows) => rows.filter((row) => row.id !== id));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete media",
      );
    }
  }
  async function reorder(targetId: string) {
    if (!draggedMedia || draggedMedia === targetId || !productId) return;
    const next = [...media],
      from = next.findIndex((x) => x.id === draggedMedia),
      to = next.findIndex((x) => x.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setMedia(next);
    setDraggedMedia(null);
    try {
      await api("/api/v1/admin/media/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, mediaIds: next.map((x) => x.id) }),
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not reorder media",
      );
    }
  }
  async function save() {
    setBusy("save");
    setError("");
    try {
      let id = productId;
      if (!id) id = await ensureDraft();
      await api(`/api/v1/admin/products/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload()),
      });
      setDirty(false);
      router.replace(`/admin/products/${id}/edit`);
      router.refresh();
    } catch (cause) {
      setError(describeError(cause, "Could not save product"));
    } finally {
      setBusy("");
    }
  }
  async function action(name: "publish" | "unpublish" | "archive") {
    if (!productId) {
      setError("Save the product before changing its status");
      return;
    }
    if (
      name === "archive" &&
      !window.confirm(
        "Archive this product? Existing order history will be preserved.",
      )
    )
      return;
    setBusy(name);
    setError("");
    try {
      if (name === "publish") await save();
      const result = await api(`/api/v1/admin/products/${productId}/${name}`, {
        method: "POST",
      });
      setStatus(result.status);
      setDirty(false);
      router.refresh();
    } catch (cause) {
      setError(describeError(cause, `Could not ${name} product`));
    } finally {
      setBusy("");
    }
  }
  const readiness = [
    {
      label: "Basic information",
      ok: Boolean(f.name && f.slug && f.internalCode),
    },
    {
      label: "Valid price",
      ok: Boolean(f.regularPrice && Number(f.regularPrice) > 0),
    },
    { label: "Active variant", ok: variants.some((v) => v.active) },
    {
      label: "Primary image",
      ok: media.some((m) => m.isPrimary && m.uploadStatus === "CONFIRMED"),
    },
    { label: "Attributes", ok: Boolean(f.fabric && f.shippingInfo) },
  ];
  const saveLabel = status === "DRAFT" ? "Save draft" : "Update product";

  return (
    <div className="product-editor">
      <div className="editor-toolbar">
        <div>
          <span className={`status status-${status.toLowerCase()}`}>
            {status}
          </span>
          {dirty && <span className="unsaved">Unsaved changes</span>}
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(busy)}
            onClick={save}
          >
            {busy === "save" ? "Saving…" : saveLabel}
          </button>
          {productId && (
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                window.open(`/api/v1/products/${f.slug}`, "_blank")
              }
            >
              Preview API
            </button>
          )}
          {status === "PUBLISHED" ? (
            <button
              type="button"
              className="btn secondary"
              disabled={Boolean(busy)}
              onClick={() => action("unpublish")}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={Boolean(busy)}
              onClick={() => action("publish")}
            >
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          )}
          <button
            type="button"
            className="btn danger"
            disabled={Boolean(busy)}
            onClick={() => action("archive")}
          >
            Archive
          </button>
        </div>
      </div>
      {error && (
        <div className="error-summary" role="alert">
          <strong>Could not complete the action</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      <Section
        title="1. Basic information"
        description="Customer-facing identity and internal catalogue controls."
      >
        <div className="form-grid">
          <Field label="Product name" error={fieldErrors.name}>
            <input
              value={f.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <Field label="Slug" error={fieldErrors.slug}>
            <input
              value={f.slug}
              onChange={(e) => {
                setSlugEdited(true);
                update("slug", e.target.value);
              }}
            />
          </Field>
          <Field label="Internal code" error={fieldErrors.internalCode}>
            <input
              value={f.internalCode}
              onChange={(e) => update("internalCode", e.target.value)}
            />
          </Field>
          <Field label="Product type">
            <select
              value={f.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {["Kurti", "Kurti Set", "Co-ord Set", "Dupatta Set"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Short description" wide>
            <textarea
              rows={2}
              value={f.shortDescription}
              onChange={(e) => update("shortDescription", e.target.value)}
            />
          </Field>
          <Field label="Full description" wide>
            <textarea
              rows={6}
              value={f.fullDescription}
              onChange={(e) => update("fullDescription", e.target.value)}
            />
          </Field>
          <Check
            label="Active product"
            checked={f.active}
            onChange={(value) => update("active", value)}
          />
        </div>
      </Section>

      <Section
        title="2. Media"
        description="Signed direct uploads. Cloudinary metadata is generated and verified automatically."
      >
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
          <strong>Drop images or video here</strong>
          <span>
            or choose files · JPG, PNG, WebP, AVIF, MP4, WebM · maximum 25 MB
          </span>
        </div>
        {uploads.length > 0 && (
          <div className="upload-list">
            {uploads.map((item) => (
              <div key={item.id}>
                <span>{item.name}</span>
                <progress value={item.progress} max={100} />
                <span>
                  {item.status}
                  {item.error ? `: ${item.error}` : ""}
                </span>
                {item.status === "uploading" && (
                  <button
                    type="button"
                    onClick={() => {
                      item.xhr?.abort();
                      setUploads((rows) =>
                        rows.map((row) =>
                          row.id === item.id
                            ? { ...row, status: "cancelled" }
                            : row,
                        ),
                      );
                    }}
                  >
                    Cancel
                  </button>
                )}
                {item.status === "failed" && item.file && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploads((rows) => rows.filter((row) => row.id !== item.id));
                      void uploadFiles([item.file!]);
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {media.length === 0 ? (
          <div className="empty-state">
            No media yet. Save basic information automatically by choosing the
            first file.
          </div>
        ) : (
          <div className="media-grid">
            {media.map((item) => (
              <article
                key={item.id}
                draggable
                onDragStart={() => setDraggedMedia(item.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void reorder(item.id)}
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
                    <strong className="primary-label">Primary image</strong>
                  )}
                  <Field label="Alt text">
                    <input
                      value={item.altText}
                      onChange={(e) =>
                        setMedia((rows) =>
                          rows.map((row) =>
                            row.id === item.id
                              ? { ...row, altText: e.target.value }
                              : row,
                          ),
                        )
                      }
                      onBlur={() =>
                        void updateMedia(item, { altText: item.altText })
                      }
                    />
                  </Field>
                  <Field label="Colour">
                    <select
                      value={item.color ?? ""}
                      onChange={(e) =>
                        void updateMedia(item, {
                          color: e.target.value || null,
                        })
                      }
                    >
                      <option value="">All colours</option>
                      {selectedColors.map((color) => (
                        <option key={color.id} value={color.id}>
                          {color.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Specific variant">
                    <select
                      value={item.assignedVariantId ?? ""}
                      onChange={(e) =>
                        void updateMedia(item, {
                          assignedVariantId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Colour-level / product-level</option>
                      {variants
                        .filter((v) => v.id)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.sku}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <details>
                    <summary>Technical details</summary>
                    <small>
                      {item.format.toUpperCase()} · {item.width}×{item.height} ·{" "}
                      {Math.round((item.bytes ?? 0) / 1024)} KB
                    </small>
                  </details>
                  <div className="row-actions">
                    {!item.isPrimary && item.type === "IMAGE" && (
                      <button
                        type="button"
                        onClick={() => void primary(item.id)}
                      >
                        Set primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        replaceId.current = item.id;
                        fileInput.current?.click();
                      }}
                    >
                      Replace
                    </button>
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
      </Section>

      <Section
        title="3. Variant configuration"
        description="Choose the dimensions that exist; unavailable combinations can remain inactive."
      >
        <div className="toggle-row">
          <Check
            label="Has multiple sizes"
            checked={hasSizes}
            onChange={(value) => {
              setHasSizes(value);
              regenerateVariants(
                selectedSizes,
                selectedColors,
                value,
                hasColors,
              );
            }}
          />
          <Check
            label="Has multiple colours"
            checked={hasColors}
            onChange={(value) => {
              setHasColors(value);
              regenerateVariants(
                selectedSizes,
                selectedColors,
                hasSizes,
                value,
              );
            }}
          />
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
            <button
              type="button"
              onClick={() => {
                const custom = prompt("Custom size label");
                if (custom && !selectedSizes.includes(custom)) {
                  const next = [...selectedSizes, custom];
                  setSelectedSizes(next);
                  regenerateVariants(next);
                }
              }}
            >
              Add custom size
            </button>
          </div>
        )}
        {hasColors && (
          <div className="color-list">
            {selectedColors.map((color, index) => (
              <div key={color.id}>
                <input
                  aria-label="Colour label"
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
                <th>SKU</th>
                <th>Stock</th>
                <th>Reserved</th>
                <th>Low stock</th>
                <th>Price override (₹)</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, index) => (
                <tr key={`${variant.color}-${variant.size}`}>
                  <td>{variant.colorLabel}</td>
                  <td>{variant.size}</td>
                  <td>
                    <input
                      value={variant.sku}
                      onChange={(e) =>
                        patchVariant(index, { sku: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={variant.reservedStock ?? 0}
                      value={variant.openingStock}
                      onChange={(e) =>
                        patchVariant(index, {
                          openingStock: Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td>{variant.reservedStock ?? 0}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={variant.lowStockThreshold}
                      onChange={(e) =>
                        patchVariant(index, {
                          lowStockThreshold: Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      inputMode="decimal"
                      value={rupees(variant.regularPricePaise)}
                      placeholder="Base"
                      onChange={(e) =>
                        patchVariant(index, {
                          regularPricePaise: e.target.value
                            ? paise(e.target.value, "Variant price")
                            : null,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={variant.active}
                      onChange={(e) =>
                        patchVariant(index, { active: e.target.checked })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="4. Pricing and inventory"
        description="Rupees are converted to integer paise before persistence."
      >
        <div className="form-grid">
          <Field label="Regular price / MRP (₹)">
            <input
              inputMode="decimal"
              value={f.regularPrice}
              onChange={(e) => update("regularPrice", e.target.value)}
            />
          </Field>
          <Field label="Sale price (₹)">
            <input
              inputMode="decimal"
              value={f.salePrice}
              onChange={(e) => update("salePrice", e.target.value)}
            />
          </Field>
          <Field label="Cost price (₹) — private">
            <input
              inputMode="decimal"
              value={f.costPrice}
              onChange={(e) => update("costPrice", e.target.value)}
            />
          </Field>
          <Check
            label="Prices include tax"
            checked={f.taxInclusive}
            onChange={(value) => update("taxInclusive", value)}
          />
        </div>
        <div className="pricing-summary">
          <span>
            Discount{" "}
            <strong>
              ₹{pricing.discount.toFixed(2)} ({pricing.discountPct}%)
            </strong>
          </span>
          <span>
            Estimated margin{" "}
            <strong>
              ₹{pricing.margin.toFixed(2)} ({pricing.marginPct}%)
            </strong>
          </span>
        </div>
        <p className="muted">
          Opening and edited stock values create inventory adjustment history.
          Reserved stock cannot be overwritten.
        </p>
      </Section>

      <Section title="5. Product attributes">
        <div className="form-grid">
          <Select
            label="Fabric"
            value={f.fabric}
            options={FABRICS}
            onChange={(value) => update("fabric", value)}
          />
          <Select
            label="Fit"
            value={f.fit}
            options={FITS}
            onChange={(value) => update("fit", value)}
          />
          <Select
            label="Pattern"
            value={f.pattern}
            options={PATTERNS}
            onChange={(value) => update("pattern", value)}
          />
          <Select
            label="Neck"
            value={f.neckType}
            options={NECKS}
            onChange={(value) => update("neckType", value)}
          />
          <Select
            label="Sleeve"
            value={f.sleeveType}
            options={SLEEVES}
            onChange={(value) => update("sleeveType", value)}
          />
          <Field label="Kurti length">
            <input
              value={f.kurtiLength}
              onChange={(e) => update("kurtiLength", e.target.value)}
            />
          </Field>
          <Field label="Primary colour family">
            <input
              value={f.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
            />
          </Field>
          <Field label="Transparency">
            <input
              value={f.transparency}
              onChange={(e) => update("transparency", e.target.value)}
            />
          </Field>
          <Field label="Lining">
            <input
              value={f.lining}
              onChange={(e) => update("lining", e.target.value)}
            />
          </Field>
          <Field label="Side slit">
            <input
              value={f.sideSlit}
              onChange={(e) => update("sideSlit", e.target.value)}
            />
          </Field>
          <Field label="Wash care">
            <input
              value={f.washCare}
              onChange={(e) => update("washCare", e.target.value)}
              placeholder="Comma separated"
            />
          </Field>
          <Field label="Country of origin">
            <input
              value={f.countryOfOrigin}
              onChange={(e) => update("countryOfOrigin", e.target.value)}
            />
          </Field>
          <Field label="Package contents" wide>
            <input
              value={f.packageContents}
              onChange={(e) => update("packageContents", e.target.value)}
            />
          </Field>
        </div>
        <div className="choice-list">
          {OCCASIONS.map((occasion) => (
            <label key={occasion}>
              <input
                type="checkbox"
                checked={f.occasions.includes(occasion)}
                onChange={(e) =>
                  update(
                    "occasions" as keyof typeof f,
                    e.target.checked
                      ? ([...f.occasions, occasion] as never)
                      : (f.occasions.filter((x) => x !== occasion) as never),
                  )
                }
              />
              {occasion}
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="6. Size and fit"
        description="Measurements are stored in tenths of an inch."
      >
        <div className="form-grid">
          <Field label="Model height (cm)">
            <input
              type="number"
              value={f.modelHeightCm}
              onChange={(e) => update("modelHeightCm", e.target.value)}
            />
          </Field>
          <Field label="Model size worn">
            <input
              value={f.modelSizeWorn}
              onChange={(e) => update("modelSizeWorn", e.target.value)}
            />
          </Field>
          <Field label="Fit indicator">
            <select
              value={f.fitIndicator}
              onChange={(e) => update("fitIndicator", e.target.value)}
            >
              <option>True to size</option>
              <option>Relaxed</option>
              <option>Slim</option>
            </select>
          </Field>
          <Field label="Fit note">
            <input
              value={f.fitNote}
              onChange={(e) => update("fitNote", e.target.value)}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() =>
            addMeasurement(prompt("Size for measurement row") ?? "")
          }
        >
          Add measurement row
        </button>
        {measurements.length === 0 ? (
          <div className="empty-state">No product-specific size guide.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Bust</th>
                  <th>Waist</th>
                  <th>Hip</th>
                  <th>Shoulder</th>
                  <th>Sleeve</th>
                  <th>Length</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {measurements.map((row, index) => (
                  <tr key={row.size}>
                    {(
                      [
                        "size",
                        "bustTenthsIn",
                        "waistTenthsIn",
                        "hipTenthsIn",
                        "shoulderTenthsIn",
                        "sleeveTenthsIn",
                        "lengthTenthsIn",
                      ] as const
                    ).map((key) => (
                      <td key={key}>
                        <input
                          value={
                            key === "size"
                              ? row[key]
                              : row[key] == null
                                ? ""
                                : Number(row[key]) / 10
                          }
                          onChange={(e) =>
                            setMeasurements((rows) =>
                              rows.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      [key]:
                                        key === "size"
                                          ? e.target.value
                                          : e.target.value
                                            ? Math.round(
                                                Number(e.target.value) * 10,
                                              )
                                            : null,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setMeasurements((rows) =>
                            rows.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="7. Merchandising">
        <div className="form-grid">
          <Check
            label="Featured"
            checked={f.featured}
            onChange={(value) => update("featured", value)}
          />
          <Check
            label="Bestseller"
            checked={f.bestseller}
            onChange={(value) => update("bestseller", value)}
          />
          <Check
            label="New arrival"
            checked={f.newArrival}
            onChange={(value) => update("newArrival", value)}
          />
          <Field label="Badge">
            <input
              value={f.badge}
              onChange={(e) => update("badge", e.target.value)}
              placeholder="New, Sale, Limited stock…"
            />
          </Field>
          <Field label="Sort priority">
            <input
              type="number"
              value={f.sortPriority}
              onChange={(e) => update("sortPriority", e.target.value)}
            />
          </Field>
          <Field label="Publish date">
            <input
              type="datetime-local"
              value={f.publishStartAt}
              onChange={(e) => update("publishStartAt", e.target.value)}
            />
          </Field>
          <Field label="Unpublish date">
            <input
              type="datetime-local"
              value={f.publishEndAt}
              onChange={(e) => update("publishEndAt", e.target.value)}
            />
          </Field>
        </div>
        <h3>Collections</h3>
        <div className="choice-list">
          {collections.map((collection) => (
            <label key={collection.id}>
              <input
                type="checkbox"
                checked={selectedCollections.includes(collection.id)}
                onChange={(e) => {
                  setSelectedCollections((ids) =>
                    e.target.checked
                      ? [...ids, collection.id]
                      : ids.filter((id) => id !== collection.id),
                  );
                  setDirty(true);
                }}
              />
              {collection.name}{" "}
              {!collection.publishedAt && <small>(draft)</small>}
            </label>
          ))}
        </div>
      </Section>

      <Section title="8. SEO and search">
        <div className="form-grid">
          <Field label={`SEO title (${f.seoTitle.length}/60 recommended)`} wide>
            <input
              value={f.seoTitle}
              onChange={(e) => update("seoTitle", e.target.value)}
            />
            {f.seoTitle.length > 60 && (
              <small className="warning">
                Longer than the search-display recommendation.
              </small>
            )}
          </Field>
          <Field
            label={`SEO description (${f.seoDescription.length}/160 recommended)`}
            wide
          >
            <textarea
              rows={3}
              value={f.seoDescription}
              onChange={(e) => update("seoDescription", e.target.value)}
            />
            {f.seoDescription.length > 160 && (
              <small className="warning">
                Longer than the search-display recommendation.
              </small>
            )}
          </Field>
          <Field label="Search keywords" wide>
            <input
              value={f.searchKeywords}
              onChange={(e) => update("searchKeywords", e.target.value)}
              placeholder="Comma separated"
            />
          </Field>
          <Check
            label="Visible in search"
            checked={f.searchVisible}
            onChange={(value) => update("searchVisible", value)}
          />
          <Check
            label="Allow indexing"
            checked={f.indexable}
            onChange={(value) => update("indexable", value)}
          />
        </div>
      </Section>

      <Section title="9. Shipping and returns">
        <div className="form-grid">
          <Field label="Dispatch days (blank = store default)">
            <input
              type="number"
              min="0"
              value={f.dispatchDays}
              onChange={(e) => update("dispatchDays", e.target.value)}
            />
          </Field>
          <Field label="Weight grams (blank = variant/store default)">
            <input
              type="number"
              min="1"
              value={f.weightGrams}
              onChange={(e) => update("weightGrams", e.target.value)}
            />
          </Field>
          <Field label="Return window days">
            <input
              type="number"
              min="0"
              value={f.returnWindowDays}
              disabled={!f.returnEligible}
              onChange={(e) => update("returnWindowDays", e.target.value)}
            />
          </Field>
          <Field label="COD override">
            <select
              value={f.codAvailableOverride}
              onChange={(e) => update("codAvailableOverride", e.target.value)}
            >
              <option value="default">Use store default</option>
              <option value="true">Allowed</option>
              <option value="false">Not allowed</option>
            </select>
          </Field>
          <Check
            label="Return eligible"
            checked={f.returnEligible}
            onChange={(value) => update("returnEligible", value)}
          />
          <Check
            label="Cancellation eligible"
            checked={f.cancellationEligible}
            onChange={(value) => update("cancellationEligible", value)}
          />
          <Field label="Shipping note" wide>
            <textarea
              rows={3}
              value={f.shippingInfo}
              onChange={(e) => update("shippingInfo", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="10. Private source information"
        description="Admin-only. Never included in storefront DTOs, tracking, or analytics."
      >
        <button
          type="button"
          onClick={() =>
            setSources((rows) => [
              ...rows,
              {
                platform: "MEESHO",
                supplierName: "",
                supplierUrl: "",
                sourceListingId: "",
                sourceSku: "",
                sourcePricePaise: null,
                availabilityState: "AVAILABLE",
                expectedDeliveryDays: null,
                notes: "",
                backupSource: false,
                active: true,
                variantMapping: {},
                lastCheckedAt: null,
              },
            ])
          }
        >
          Add source
        </button>
        {sources.length === 0 ? (
          <div className="empty-state">No private source records.</div>
        ) : (
          sources.map((source, index) => (
            <div className="source-card" key={source.id ?? index}>
              <div className="form-grid">
                <Field label="Platform">
                  <select
                    value={source.platform}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, platform: e.target.value }
                            : row,
                        ),
                      )
                    }
                  >
                    <option>MEESHO</option>
                    <option>OTHER</option>
                  </select>
                </Field>
                <Field label="Supplier name">
                  <input
                    value={source.supplierName}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, supplierName: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Source URL">
                  <input
                    type="url"
                    value={source.supplierUrl}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, supplierUrl: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Listing ID">
                  <input
                    value={source.sourceListingId}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, sourceListingId: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Source SKU">
                  <input
                    value={source.sourceSku}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, sourceSku: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Source price (₹)">
                  <input
                    inputMode="decimal"
                    value={rupees(source.sourcePricePaise)}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                sourcePricePaise: e.target.value
                                  ? paise(e.target.value, "Source price")
                                  : null,
                              }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Availability">
                  <input
                    value={source.availabilityState}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, availabilityState: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Expected delivery days">
                  <input
                    type="number"
                    min="0"
                    value={source.expectedDeliveryDays ?? ""}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                expectedDeliveryDays: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Internal notes" wide>
                  <textarea
                    value={source.notes}
                    onChange={(e) =>
                      setSources((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, notes: e.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Check
                  label="Backup source"
                  checked={source.backupSource}
                  onChange={(value) =>
                    setSources((rows) =>
                      rows.map((row, i) =>
                        i === index ? { ...row, backupSource: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <button
                type="button"
                className="text-danger"
                onClick={() =>
                  setSources((rows) => rows.filter((_, i) => i !== index))
                }
              >
                Remove source
              </button>
            </div>
          ))
        )}
      </Section>

      <Section
        title="11. Preview and publishing"
        description="Draft data is preserved when readiness validation fails."
      >
        <ul className="readiness">
          {readiness.map((item) => (
            <li key={item.label} className={item.ok ? "ready" : "not-ready"}>
              {item.ok ? "✓" : "○"} {item.label}
            </li>
          ))}
        </ul>
        <div className="editor-actions">
          <button
            type="button"
            className={status === "PUBLISHED" ? "btn" : "btn secondary"}
            disabled={Boolean(busy)}
            onClick={save}
          >
            {busy === "save" ? "Saving…" : saveLabel}
          </button>
          {status !== "PUBLISHED" && (
            <button
              type="button"
              className="btn"
              disabled={!readiness.every((item) => item.ok) || Boolean(busy)}
              onClick={() => action("publish")}
            >
              Publish product
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="editor-section card">
      <div className="section-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      {label}
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}
