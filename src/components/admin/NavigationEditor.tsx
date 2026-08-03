"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/admin/product-form-utils";
import { api } from "@/lib/admin/api-client";

type NavItem = { id: string; label: string; href: string; isSale: boolean };

export function NavigationEditor({
  initialItems,
}: {
  initialItems: Array<{ id: string; label: string; href: string; isSale?: boolean }>;
}) {
  const router = useRouter();
  const [items, setItems] = useState<NavItem[]>(
    initialItems.map((i) => ({ id: i.id, label: i.label, href: i.href, isSale: i.isSale ?? false })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function patch(index: number, changes: Partial<NavItem>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
    setSuccess(false);
  }

  function addItem() {
    setItems((rows) => [...rows, { id: `item-${rows.length}`, label: "", href: "/", isSale: false }]);
    setSuccess(false);
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
    setSuccess(false);
  }

  function move(index: number, direction: -1 | 1) {
    setItems((rows) => {
      const next = [...rows];
      const target = index + direction;
      if (target < 0 || target >= next.length) return rows;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSuccess(false);
  }

  async function save() {
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const primary = items.map((item) => ({
        id: item.id || slugify(item.label) || crypto.randomUUID(),
        label: item.label,
        href: item.href,
        isSale: item.isSale,
      }));
      await api("/api/v1/admin/navigation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ primary }),
      });
      setSuccess(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save navigation");
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
      {success && <p className="muted">Saved and published.</p>}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Link</th>
              <th>Sale styling</th>
              <th>Order</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>
                  <input value={item.label} onChange={(e) => patch(index, { label: e.target.value })} />
                </td>
                <td>
                  <input
                    value={item.href}
                    onChange={(e) => patch(index, { href: e.target.value })}
                    placeholder="/collections/new-arrivals"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={item.isSale}
                    onChange={(e) => patch(index, { isSale: e.target.checked })}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                    ↑
                  </button>{" "}
                  <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                    ↓
                  </button>
                </td>
                <td>
                  <button type="button" className="text-danger" onClick={() => removeItem(index)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && <p className="muted">No navigation items yet.</p>}

      <div className="editor-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn secondary" onClick={addItem}>
          + Add item
        </button>
        <button type="button" className="btn" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save & publish"}
        </button>
      </div>
    </div>
  );
}
