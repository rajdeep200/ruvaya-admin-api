import { campaignSchema } from "../../ruvaya-storefront/src/lib/validation/campaign";
import { cartValidationResponseSchema } from "../../ruvaya-storefront/src/lib/validation/cart";
import { checkoutResponseSchema, serviceabilityResponseSchema } from "../../ruvaya-storefront/src/lib/validation/checkout";
import { collectionDetailSchema, collectionSummarySchema } from "../../ruvaya-storefront/src/lib/validation/collection";
import { homepageResponseSchema } from "../../ruvaya-storefront/src/lib/validation/homepage";
import { navigationResponseSchema } from "../../ruvaya-storefront/src/lib/validation/navigation";
import { orderDetailSchema, trackOrderResponseSchema } from "../../ruvaya-storefront/src/lib/validation/order";
import { paymentRetryResponseSchema, paymentStatusResponseSchema } from "../../ruvaya-storefront/src/lib/validation/payment";
import { productDetailSchema, productListResponseSchema } from "../../ruvaya-storefront/src/lib/validation/product";
import { reviewListResponseSchema, reviewTokenContextSchema } from "../../ruvaya-storefront/src/lib/validation/review";
import { searchResultsResponseSchema, searchSuggestionsResponseSchema } from "../../ruvaya-storefront/src/lib/validation/search";
import { storefrontConfigSchema } from "../../ruvaya-storefront/src/lib/validation/storefrontConfig";

const image = { id: "media-1", url: "https://example.com/ruvaya.jpg", alt: "Ruvaya", width: 1200, height: 1500 };
const product = { id: "product-1", slug: "sample-kurti", name: "Sample Kurti", category: "Kurti", collectionSlugs: ["new-arrivals"], fabric: "Cotton", occasion: ["Everyday"], price: { amount: 1200, currency: "INR" }, salePrice: null, badges: ["new"], colors: [{ name: "Blue", hex: "#0000ff" }], rating: { average: 0, count: 0 }, isAvailable: true, primaryImage: image };
const detail = { ...product, description: "Sample published product", images: [image], colorVariants: [{ id: "blue", name: "Blue", hex: "#0000ff", images: [image], sizes: [{ size: "M", sku: "SAMPLE-M", inStock: true }] }], fabricDetails: "Cotton", fitDetails: "Regular", neckType: "Round", sleeveType: "Three-quarter", kurtiLength: "Knee", washCare: ["Gentle wash"], measurements: [], shippingInfo: "Ships after payment verification", returnEligible: true, returnWindowDays: 7, inclusiveOfTaxes: true, similarProductSlugs: [] };
const collection = { id: "collection-1", slug: "new-arrivals", name: "New Arrivals", image };
const capability = "opaque-payment-capability-with-at-least-32-random-characters";
const now = new Date().toISOString();
const checks: Array<[string, { parse(value: unknown): unknown }, unknown]> = [
  ["storefront/config", storefrontConfigSchema, { announcementMessages: [], whatsappNumber: "+919000000000", supportEmail: "support@ruvaya.com", supportPhone: "+919000000000", supportHours: "10:00-18:00", addressLine: "India", socialLinks: [], footerColumns: [], legalText: "Ruvaya", maintenanceMode: false }],
  ["storefront/homepage", homepageResponseSchema, { hero: { heading: "Ruvaya", subheading: "Styles", ctaLabel: "Shop", ctaHref: "/collections", image }, shopByCollection: [], bestSellers: [], seasonalCampaign: null, trustItems: [], featuredReviews: [], styleInspiration: [], newsletterHeading: "Stay in touch", newsletterSubtext: "Updates", whatsappHeading: "Help", whatsappSubtext: "Contact us" }],
  ["navigation", navigationResponseSchema, { primary: [{ id: "collections", label: "Collections", href: "/collections", isSale: false }] }],
  ["products", productListResponseSchema, { items: [product], filters: { sizes: ["M"], colors: product.colors, fabrics: [product.fabric], occasions: product.occasion, priceRange: { min: 1200, max: 1200 } }, totalItems: 1 }], ["products/:slug", productDetailSchema, detail],
  ["collections", { parse: (value) => collectionSummarySchema.array().parse(value) }, [collection]], ["collections/:slug", collectionDetailSchema, { ...collection, products: [product] }],
  ["campaigns", { parse: (value) => campaignSchema.array().parse(value) }, [{ id: "campaign-1", slug: "sale", title: "Sale", bannerImage: image, startAt: now, endAt: now, status: "active", products: [product] }]], ["campaigns/:slug", campaignSchema, { id: "campaign-1", slug: "sale", title: "Sale", bannerImage: image, startAt: now, endAt: now, status: "active", products: [product] }],
  ["search suggest", searchSuggestionsResponseSchema, { popularSearches: [], productSuggestions: [product], collectionSuggestions: [collection] }], ["search results", searchResultsResponseSchema, { query: "kurti", products: [product], collections: [collection], totalItems: 1 }],
  ["serviceability", serviceabilityResponseSchema, { pincode: "560001", isServiceable: true, codAvailable: false }], ["cart/validate", cartValidationResponseSchema, { lines: [{ productId: product.id, colorId: "blue", size: "M", requestedQuantity: 1, maxQuantity: 1, isAvailable: true, unitPrice: 1200, unitSalePrice: null, priceChanged: false }], subtotal: 1200, discount: 0, shippingFee: 0, total: 1200, couponApplied: null, couponError: null, messages: [], isCheckoutBlocked: false }],
  ["checkout", checkoutResponseSchema, { orderId: capability, orderNumber: "RUV-1", paymentSessionId: "session", paymentGatewayOrderId: "provider-order", amount: 1200, currency: "INR" }], ["payments/status", paymentStatusResponseSchema, { orderId: capability, orderNumber: "RUV-1", status: "pending", amountPaid: null, canRetry: false, moneyMayBeDeducted: true, message: "Pending" }], ["payments/retry", paymentRetryResponseSchema, { paymentSessionId: "session", paymentGatewayOrderId: "provider-order", amount: 1200, currency: "INR" }],
  ["orders/track", trackOrderResponseSchema, { secureToken: "opaque-order-token" }], ["orders/:secureToken", orderDetailSchema, { orderNumber: "RUV-1", secureToken: "opaque-order-token", status: "payment_received", paymentStatus: "success", placedAt: now, items: [{ productName: product.name, productSlug: product.slug, image, size: "M", color: "Blue", quantity: 1, unitPrice: 1200 }], subtotal: 1200, discount: 0, shippingFee: 0, amountPaid: 1200, shippingAddress: { fullName: "Customer", addressLine: "Address", city: "Bengaluru", state: "Karnataka", pincode: "560001" }, timeline: [{ status: "payment_received", label: "Paid", timestamp: now, completed: true }], estimatedDeliveryAt: null }],
  ["reviews", reviewListResponseSchema, { summary: { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }, reviews: [], totalItems: 0 }], ["reviews/:secureToken", reviewTokenContextSchema, { isValid: true, alreadySubmitted: false }],
];
let failed = 0;
for (const [name, schema, fixture] of checks) { try { schema.parse(fixture); process.stdout.write(`PASS ${name}\n`); } catch (error) { failed++; process.stderr.write(`FAIL ${name}: ${String(error)}\n`); } }
if (failed) process.exit(1);
