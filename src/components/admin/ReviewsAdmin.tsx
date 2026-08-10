"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/admin/api-client";
import { AssetUploadField, type UploadedImage } from "./AssetUploadField";

type ProductOption = { id: string; name: string; internalCode: string };

export type ReviewRow = {
  id: string;
  productId: string;
  productName: string;
  displayName: string;
  rating: number;
  title: string;
  text: string;
  status: string;
  media: { id: string; secureUrl: string }[];
};

type Props = {
  allProducts: ProductOption[];
  initialReviews: ReviewRow[];
};

function StarPicker({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return (
    <div className="row-actions" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          style={{ fontSize: 22, lineHeight: 1, background: "none", border: 0, cursor: "pointer", padding: 2 }}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

export function ReviewsAdmin({ allProducts, initialReviews }: Props) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [productId, setProductId] = useState(allProducts[0]?.id ?? "");
  const [displayName, setDisplayName] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [images, setImages] = useState<{ id: string; image: UploadedImage | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function addImageSlot() {
    setImages((rows) => [...rows, { id: crypto.randomUUID(), image: null }]);
  }

  function removeImageSlot(id: string) {
    setImages((rows) => rows.filter((row) => row.id !== id));
  }

  async function addReview() {
    setError("");
    if (!productId) {
      setError("Choose a product");
      return;
    }
    if (!displayName.trim() || !text.trim()) {
      setError("Customer name and review text are required");
      return;
    }
    setBusy(true);
    try {
      const created = await api("/api/v1/admin/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          displayName: displayName.trim(),
          rating,
          title: title.trim(),
          text: text.trim(),
          status: publishNow ? "APPROVED" : "PENDING",
          media: images
            .map((row) => row.image)
            .filter((img): img is UploadedImage => Boolean(img?.publicId))
            .map((img) => ({ publicId: img.publicId, secureUrl: img.url })),
        }),
      });
      setReviews((rows) => [
        {
          id: created.id,
          productId: created.productId,
          productName: created.product.name,
          displayName: created.displayName,
          rating: created.rating,
          title: created.title,
          text: created.text,
          status: created.status,
          media: created.media,
        },
        ...rows,
      ]);
      setDisplayName("");
      setRating(5);
      setTitle("");
      setText("");
      setImages([]);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add review");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "APPROVED" | "HIDDEN") {
    setRowBusyId(id);
    setError("");
    try {
      await api(`/api/v1/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setReviews((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update review");
    } finally {
      setRowBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this review permanently? This cannot be undone.")) return;
    setRowBusyId(id);
    setError("");
    try {
      await api(`/api/v1/admin/reviews/${id}`, { method: "DELETE" });
      setReviews((rows) => rows.filter((r) => r.id !== id));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete review");
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <>
      {error && (
        <div className="error-summary" role="alert">
          <strong>Something went wrong</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Add a review</h2>
        <p className="muted">
          For reviews collected outside the storefront (WhatsApp, Instagram, in person). These publish under the
          customer name you enter and are not marked as a verified purchase.
        </p>
        <div className="form-grid">
          <label className="field">
            Product
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.internalCode})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Customer name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Priya S." />
          </label>
          <label className="field">
            Rating
            <StarPicker value={rating} onChange={setRating} />
          </label>
          <label className="field">
            Title (optional)
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Loved it!" />
          </label>
          <label className="field wide">
            Review text
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the customer said…" />
          </label>
        </div>

        <div className="media-grid">
          {images.map((slot, index) => (
            <div key={slot.id} className="source-card">
              <AssetUploadField
                label={`Photo ${index + 1}`}
                value={slot.image}
                signatureEndpoint="/api/v1/admin/reviews/media/upload-signature"
                confirmEndpoint="/api/v1/admin/reviews/media/confirm"
                onChange={(img) =>
                  setImages((rows) => rows.map((row) => (row.id === slot.id ? { ...row, image: img } : row)))
                }
              />
              <button type="button" className="text-danger" onClick={() => removeImageSlot(slot.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addImageSlot} style={{ marginTop: 8 }}>
          + Add photo
        </button>

        <label className="check" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
          <span>Publish immediately (otherwise saved as pending)</span>
        </label>

        <div className="editor-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn" disabled={busy} onClick={addReview}>
            {busy ? "Adding…" : "Add review"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Customer</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Review</th>
                <th>Photos</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>{r.productName}</td>
                  <td>{r.displayName}</td>
                  <td>{r.rating}/5</td>
                  <td>
                    <span className="pill">{r.status}</span>
                  </td>
                  <td>
                    <strong>{r.title}</strong>
                    <div className="muted">{r.text}</div>
                  </td>
                  <td>
                    <div className="row-actions">
                      {r.media.map((m) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={m.id} src={m.secureUrl} alt="" width={40} height={40} style={{ objectFit: "cover", borderRadius: 6 }} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      {r.status === "APPROVED" ? (
                        <button type="button" disabled={rowBusyId === r.id} onClick={() => setStatus(r.id, "HIDDEN")}>
                          Hide
                        </button>
                      ) : (
                        <button type="button" disabled={rowBusyId === r.id} onClick={() => setStatus(r.id, "APPROVED")}>
                          Show
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-danger"
                        disabled={rowBusyId === r.id}
                        onClick={() => remove(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!reviews.length && <p className="muted">No reviews yet. Add the first one above.</p>}
      </div>
    </>
  );
}
