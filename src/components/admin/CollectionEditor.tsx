"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/admin/product-form-utils";
import { api } from "@/lib/admin/api-client";

type ProductOption = { id: string; name: string; internalCode: string };

type InitialCollection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  publishedAt: string | null;
  position: number;
  productIds: string[];
};

type Props = {
  allProducts: ProductOption[];
  initial?: InitialCollection;
};

export function CollectionEditor({ allProducts, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [published, setPublished] = useState(Boolean(initial?.publishedAt));
  const [position, setPosition] = useState(String(initial?.position ?? 0));
  const [productIds, setProductIds] = useState<string[]>(initial?.productIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function toggleProduct(id: string) {
    setProductIds((rows) => (rows.includes(id) ? rows.filter((x) => x !== id) : [...rows, id]));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        name,
        slug,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        active,
        position: Number(position) || 0,
        productIds,
      };
      if (initial) {
        await api(`/api/v1/admin/collections/${initial.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...payload,
            description: description || null,
            imageUrl: imageUrl || null,
            published,
          }),
        });
        router.push("/admin/collections");
        router.refresh();
      } else {
        const created = await api("/api/v1/admin/collections", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (published) {
          await api(`/api/v1/admin/collections/${created.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ published: true }),
          });
        }
        router.push("/admin/collections");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save collection");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!initial) return;
    if (!window.confirm("Archive this collection? It will be hidden from the storefront.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/admin/collections/${initial.id}`, { method: "DELETE" });
      router.push("/admin/collections");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive collection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      {error && (
        <div className="error-summary" role="alert">
          <strong>Could not save</strong>
          <p>{error}</p>
        </div>
      )}
      <div className="form-grid">
        <label className="field">
          Name
          <input value={name} onChange={(e) => updateName(e.target.value)} />
        </label>
        <label className="field">
          Slug
          <input
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
          />
        </label>
        <label className="field wide">
          Description
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field wide">
          Image URL
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://res.cloudinary.com/..."
          />
        </label>
        <label className="field">
          Sort position
          <input type="number" min="0" value={position} onChange={(e) => setPosition(e.target.value)} />
        </label>
        <Check label="Active" checked={active} onChange={setActive} />
        <Check label="Published (visible on storefront)" checked={published} onChange={setPublished} />
      </div>

      <h3 style={{ marginTop: 20 }}>Products in this collection</h3>
      <div className="choice-list">
        {allProducts.map((p) => (
          <label key={p.id}>
            <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
            {p.name} <small className="muted">({p.internalCode})</small>
          </label>
        ))}
        {!allProducts.length && <p className="muted">No products yet.</p>}
      </div>

      <div className="editor-actions" style={{ marginTop: 20 }}>
        <button type="button" className="btn" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save collection"}
        </button>
        {initial && (
          <button type="button" className="btn danger" disabled={busy} onClick={archive}>
            Archive
          </button>
        )}
      </div>
    </div>
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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
