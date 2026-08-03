"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/admin/api-client";
import { AssetUploadField, type UploadedImage } from "./AssetUploadField";

type CollectionOption = { id: string; name: string; imageUrl: string | null };
type ProductOption = { id: string; name: string; internalCode: string };
type ReviewOption = { id: string; productName: string; displayName: string; rating: number; snippet: string };
type TrustItem = { id: string; icon: string; title: string; description: string };
type InspirationItem = { id: string; image: UploadedImage | null; href: string };

const ICONS = ["fabric", "handcrafted", "returns", "shipping", "secure"];

// The stored content is a fully-resolved snapshot (see composeHomepageContent),
// not the admin-input shape — extract the pieces this editor needs from it,
// tolerating a missing/older/partial shape.
function extractInitial(content: unknown) {
  const c = (content ?? {}) as Record<string, unknown>;
  const hero = (c.hero ?? {}) as Record<string, unknown>;
  const heroImage = (hero.image ?? null) as UploadedImage | null;
  const campaign = c.seasonalCampaign as Record<string, unknown> | null;
  const campaignImage = campaign ? ((campaign.image ?? null) as UploadedImage | null) : null;
  const shopByCollection = (c.shopByCollection ?? []) as Array<{ id: string }>;
  const bestSellers = (c.bestSellers ?? []) as Array<{ id: string }>;
  const featuredReviews = (c.featuredReviews ?? []) as Array<{ id: string }>;
  const trustItems = (c.trustItems ?? []) as TrustItem[];
  const styleInspiration = (c.styleInspiration ?? []) as Array<{
    id: string;
    image: UploadedImage;
    href?: string;
  }>;

  return {
    heroHeading: String(hero.heading ?? ""),
    heroSubheading: String(hero.subheading ?? ""),
    heroCtaLabel: String(hero.ctaLabel ?? "Shop now"),
    heroCtaHref: String(hero.ctaHref ?? "/collections"),
    heroImage,
    shopByCollectionIds: shopByCollection.map((x) => x.id),
    bestSellerProductIds: bestSellers.map((x) => x.id),
    campaignEnabled: Boolean(campaign),
    campaignEyebrow: String(campaign?.eyebrow ?? ""),
    campaignTitle: String(campaign?.title ?? ""),
    campaignSubtitle: String(campaign?.subtitle ?? ""),
    campaignCtaLabel: String(campaign?.ctaLabel ?? "Shop now"),
    campaignCtaHref: String(campaign?.ctaHref ?? "/collections"),
    campaignImage,
    trustItems,
    featuredReviewIds: featuredReviews.map((x) => x.id),
    styleInspiration: styleInspiration.map((s) => ({ id: s.id, image: s.image, href: s.href ?? "" })),
    newsletterHeading: String(c.newsletterHeading ?? "Stay in touch"),
    newsletterSubtext: String(c.newsletterSubtext ?? "Receive product and collection updates."),
    whatsappHeading: String(c.whatsappHeading ?? "Need help?"),
    whatsappSubtext: String(c.whatsappSubtext ?? "Contact the Ruvaya support team."),
  };
}

export function HomepageEditor({
  initialContent,
  collections,
  products,
  reviews,
}: {
  initialContent: unknown;
  collections: CollectionOption[];
  products: ProductOption[];
  reviews: ReviewOption[];
}) {
  const router = useRouter();
  const init = extractInitial(initialContent);

  const [heroHeading, setHeroHeading] = useState(init.heroHeading);
  const [heroSubheading, setHeroSubheading] = useState(init.heroSubheading);
  const [heroCtaLabel, setHeroCtaLabel] = useState(init.heroCtaLabel);
  const [heroCtaHref, setHeroCtaHref] = useState(init.heroCtaHref);
  const [heroImage, setHeroImage] = useState<UploadedImage | null>(init.heroImage);

  const [shopByCollectionIds, setShopByCollectionIds] = useState<string[]>(init.shopByCollectionIds);
  const [bestSellerProductIds, setBestSellerProductIds] = useState<string[]>(init.bestSellerProductIds);

  const [campaignEnabled, setCampaignEnabled] = useState(init.campaignEnabled);
  const [campaignEyebrow, setCampaignEyebrow] = useState(init.campaignEyebrow);
  const [campaignTitle, setCampaignTitle] = useState(init.campaignTitle);
  const [campaignSubtitle, setCampaignSubtitle] = useState(init.campaignSubtitle);
  const [campaignCtaLabel, setCampaignCtaLabel] = useState(init.campaignCtaLabel);
  const [campaignCtaHref, setCampaignCtaHref] = useState(init.campaignCtaHref);
  const [campaignImage, setCampaignImage] = useState<UploadedImage | null>(init.campaignImage);

  const [trustItems, setTrustItems] = useState<TrustItem[]>(init.trustItems);
  const [featuredReviewIds, setFeaturedReviewIds] = useState<string[]>(init.featuredReviewIds);
  const [styleInspiration, setStyleInspiration] = useState<InspirationItem[]>(init.styleInspiration);

  const [newsletterHeading, setNewsletterHeading] = useState(init.newsletterHeading);
  const [newsletterSubtext, setNewsletterSubtext] = useState(init.newsletterSubtext);
  const [whatsappHeading, setWhatsappHeading] = useState(init.whatsappHeading);
  const [whatsappSubtext, setWhatsappSubtext] = useState(init.whatsappSubtext);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function toggle(ids: string[], setIds: (v: string[]) => void, id: string) {
    setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  function addTrustItem() {
    setTrustItems((rows) => [...rows, { id: `trust-${rows.length}`, icon: "secure", title: "", description: "" }]);
  }
  function patchTrustItem(index: number, changes: Partial<TrustItem>) {
    setTrustItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }
  function removeTrustItem(index: number) {
    setTrustItems((rows) => rows.filter((_, i) => i !== index));
  }
  function moveTrustItem(index: number, direction: -1 | 1) {
    setTrustItems((rows) => {
      const next = [...rows];
      const target = index + direction;
      if (target < 0 || target >= next.length) return rows;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addInspiration() {
    setStyleInspiration((rows) => [...rows, { id: `inspo-${rows.length}-${Date.now()}`, image: null, href: "" }]);
  }
  function removeInspiration(index: number) {
    setStyleInspiration((rows) => rows.filter((_, i) => i !== index));
  }

  async function save() {
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      if (!heroImage) throw new Error("Please upload a hero image");
      if (campaignEnabled && !campaignImage) throw new Error("Please upload a seasonal campaign image");
      const missingInspiration = styleInspiration.find((s) => !s.image);
      if (missingInspiration) throw new Error("Please upload an image for every style inspiration entry, or remove it");

      const payload = {
        hero: {
          heading: heroHeading,
          subheading: heroSubheading,
          ctaLabel: heroCtaLabel,
          ctaHref: heroCtaHref,
          image: heroImage,
        },
        shopByCollectionIds,
        bestSellerProductIds,
        seasonalCampaign: campaignEnabled
          ? {
              eyebrow: campaignEyebrow,
              title: campaignTitle,
              subtitle: campaignSubtitle,
              ctaLabel: campaignCtaLabel,
              ctaHref: campaignCtaHref,
              image: campaignImage,
            }
          : null,
        trustItems,
        featuredReviewIds,
        styleInspiration: styleInspiration.map((s) => ({
          id: s.id,
          image: s.image,
          ...(s.href ? { href: s.href } : {}),
        })),
        newsletterHeading,
        newsletterSubtext,
        whatsappHeading,
        whatsappSubtext,
      };

      const created = await api("/api/v1/admin/homepage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await api("/api/v1/admin/homepage/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: created.version }),
      });
      setSuccess(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save homepage");
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

      <h2>Hero</h2>
      <div className="form-grid">
        <label className="field">
          Heading
          <input value={heroHeading} onChange={(e) => setHeroHeading(e.target.value)} />
        </label>
        <label className="field">
          CTA label
          <input value={heroCtaLabel} onChange={(e) => setHeroCtaLabel(e.target.value)} />
        </label>
        <label className="field wide">
          Subheading
          <textarea rows={2} value={heroSubheading} onChange={(e) => setHeroSubheading(e.target.value)} />
        </label>
        <label className="field">
          CTA link
          <input value={heroCtaHref} onChange={(e) => setHeroCtaHref(e.target.value)} placeholder="/collections" />
        </label>
        <AssetUploadField label="Hero image" value={heroImage} onChange={setHeroImage} />
      </div>

      <h2 style={{ marginTop: 24 }}>Shop by collection</h2>
      <div className="choice-list">
        {collections.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={shopByCollectionIds.includes(c.id)}
              onChange={() => toggle(shopByCollectionIds, setShopByCollectionIds, c.id)}
            />
            {c.name}{" "}
            {!c.imageUrl?.startsWith("https://") && (
              <small className="warning">(needs an https image set on the collection — won&apos;t show)</small>
            )}
          </label>
        ))}
        {!collections.length && <p className="muted">No collections yet.</p>}
      </div>

      <h2 style={{ marginTop: 24 }}>Best sellers</h2>
      <div className="choice-list">
        {products.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={bestSellerProductIds.includes(p.id)}
              onChange={() => toggle(bestSellerProductIds, setBestSellerProductIds, p.id)}
            />
            {p.name} <small className="muted">({p.internalCode})</small>
          </label>
        ))}
        {!products.length && <p className="muted">No products yet.</p>}
      </div>

      <h2 style={{ marginTop: 24 }}>Seasonal campaign banner</h2>
      <label className="check">
        <input type="checkbox" checked={campaignEnabled} onChange={(e) => setCampaignEnabled(e.target.checked)} />
        <span>Show a seasonal campaign banner</span>
      </label>
      {campaignEnabled && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field">
            Eyebrow
            <input value={campaignEyebrow} onChange={(e) => setCampaignEyebrow(e.target.value)} placeholder="Limited time" />
          </label>
          <label className="field">
            Title
            <input value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} />
          </label>
          <label className="field wide">
            Subtitle
            <input value={campaignSubtitle} onChange={(e) => setCampaignSubtitle(e.target.value)} />
          </label>
          <label className="field">
            CTA label
            <input value={campaignCtaLabel} onChange={(e) => setCampaignCtaLabel(e.target.value)} />
          </label>
          <label className="field">
            CTA link
            <input value={campaignCtaHref} onChange={(e) => setCampaignCtaHref(e.target.value)} />
          </label>
          <AssetUploadField label="Campaign image" value={campaignImage} onChange={setCampaignImage} />
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>Trust strip</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Title</th>
              <th>Description</th>
              <th>Order</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {trustItems.map((item, index) => (
              <tr key={item.id}>
                <td>
                  <select value={item.icon} onChange={(e) => patchTrustItem(index, { icon: e.target.value })}>
                    {ICONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input value={item.title} onChange={(e) => patchTrustItem(index, { title: e.target.value })} />
                </td>
                <td>
                  <input
                    value={item.description}
                    onChange={(e) => patchTrustItem(index, { description: e.target.value })}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => moveTrustItem(index, -1)} disabled={index === 0}>
                    ↑
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => moveTrustItem(index, 1)}
                    disabled={index === trustItems.length - 1}
                  >
                    ↓
                  </button>
                </td>
                <td>
                  <button type="button" className="text-danger" onClick={() => removeTrustItem(index)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addTrustItem} style={{ marginTop: 8 }}>
        + Add trust item
      </button>

      <h2 style={{ marginTop: 24 }}>Featured reviews</h2>
      <div className="choice-list">
        {reviews.map((r) => (
          <label key={r.id}>
            <input
              type="checkbox"
              checked={featuredReviewIds.includes(r.id)}
              onChange={() => toggle(featuredReviewIds, setFeaturedReviewIds, r.id)}
            />
            {r.displayName} — {r.productName} ({r.rating}/5) <small className="muted">&ldquo;{r.snippet}&rdquo;</small>
          </label>
        ))}
        {!reviews.length && <p className="muted">No approved reviews yet.</p>}
      </div>

      <h2 style={{ marginTop: 24 }}>Style inspiration gallery</h2>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {styleInspiration.map((item, index) => (
          <div key={item.id} className="source-card">
            <AssetUploadField
              label={`Image ${index + 1}`}
              value={item.image}
              onChange={(image) =>
                setStyleInspiration((rows) => rows.map((row, i) => (i === index ? { ...row, image } : row)))
              }
            />
            <label className="field">
              Link (optional)
              <input
                value={item.href}
                onChange={(e) =>
                  setStyleInspiration((rows) =>
                    rows.map((row, i) => (i === index ? { ...row, href: e.target.value } : row)),
                  )
                }
                placeholder="/collections/new-arrivals"
              />
            </label>
            <button type="button" className="text-danger" onClick={() => removeInspiration(index)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addInspiration} style={{ marginTop: 8 }}>
        + Add image
      </button>

      <h2 style={{ marginTop: 24 }}>Newsletter & WhatsApp band</h2>
      <div className="form-grid">
        <label className="field">
          Newsletter heading
          <input value={newsletterHeading} onChange={(e) => setNewsletterHeading(e.target.value)} />
        </label>
        <label className="field">
          Newsletter subtext
          <input value={newsletterSubtext} onChange={(e) => setNewsletterSubtext(e.target.value)} />
        </label>
        <label className="field">
          WhatsApp heading
          <input value={whatsappHeading} onChange={(e) => setWhatsappHeading(e.target.value)} />
        </label>
        <label className="field">
          WhatsApp subtext
          <input value={whatsappSubtext} onChange={(e) => setWhatsappSubtext(e.target.value)} />
        </label>
      </div>

      <div className="editor-actions" style={{ marginTop: 24 }}>
        <button type="button" className="btn" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save & publish"}
        </button>
      </div>
    </div>
  );
}
