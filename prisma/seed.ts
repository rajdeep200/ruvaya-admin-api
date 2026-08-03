import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();
const permissions = ["catalogue.read", "catalogue.write", "orders.read", "orders.write", "customers.sensitive.read", "payments.reconcile", "refunds.write", "reviews.write", "marketing.write", "analytics.read", "settings.write", "audit.read", "exports.read"];

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password || password.length < 8) throw new Error("ADMIN_SEED_EMAIL and a 8+ character ADMIN_SEED_PASSWORD are required");
  const appUrl = new URL(process.env.APP_URL ?? "http://localhost:3001").origin;
  const image = { id: "seed-brand-placeholder", url: `${appUrl}/brand-placeholder.svg`, alt: "Ruvaya", width: 1200, height: 1500 };
  const role = await prisma.adminRole.upsert({ where: { name: "SUPER_ADMIN" }, update: {}, create: { name: "SUPER_ADMIN", description: "Full administrative access" } });
  for (const key of permissions) {
    const permission = await prisma.adminPermission.upsert({ where: { key }, update: {}, create: { key } });
    await prisma.adminRolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
  }
  const user = await prisma.adminUser.upsert({ where: { email }, update: {}, create: { email, displayName: "Ruvaya Administrator", passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
  await prisma.adminUserRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  await prisma.storeSetting.upsert({ where: { id: "default" }, update: { supportEmail: "support@ruvaya.com" }, create: { id: "default", storeName: "Ruvaya", timezone: "Asia/Kolkata", currency: "INR", supportEmail: "support@ruvaya.com" } });
  await prisma.storefrontConfigVersion.upsert({ where: { version: 1 }, update: {}, create: { version: 1, status: "PUBLISHED", publishedAt: new Date(), content: { announcementMessages: ["Welcome to Ruvaya"], whatsappNumber: "+919000000000", supportEmail: "support@ruvaya.com", supportPhone: "+919000000000", supportHours: "Monday-Saturday, 10:00-18:00 IST", addressLine: "India", socialLinks: [], footerColumns: [{ heading: "Policies", links: [{ label: "Privacy", href: "/privacy-policy" }, { label: "Returns", href: "/return-policy" }] }], legalText: `© ${new Date().getFullYear()} Ruvaya`, maintenanceMode: false } } });
  await prisma.homepageVersion.upsert({ where: { version: 1 }, update: {}, create: { version: 1, status: "PUBLISHED", publishedAt: new Date(), content: { hero: { heading: "Ruvaya", subheading: "Thoughtfully selected styles", ctaLabel: "Shop collections", ctaHref: "/collections", image }, shopByCollection: [], bestSellers: [], seasonalCampaign: null, trustItems: [{ id: "secure", icon: "secure", title: "Secure checkout", description: "Payments are verified server-side." }], featuredReviews: [], styleInspiration: [], newsletterHeading: "Stay in touch", newsletterSubtext: "Receive product and collection updates.", whatsappHeading: "Need help?", whatsappSubtext: "Contact the Ruvaya support team." } } });
  await prisma.navigationVersion.upsert({ where: { version: 1 }, update: {}, create: { version: 1, status: "PUBLISHED", publishedAt: new Date(), content: { primary: [{ id: "collections", label: "Collections", href: "/collections", isSale: false }] } } });
  const collection = await prisma.collection.upsert({ where: { slug: "new-arrivals" }, update: {}, create: { slug: "new-arrivals", name: "New Arrivals", description: "The latest Ruvaya styles", imageUrl: image.url, active: true, publishedAt: new Date() } });
  void collection;
  for (const [slug, title] of [["privacy-policy", "Privacy Policy"], ["terms", "Terms and Conditions"], ["shipping-policy", "Shipping Policy"], ["return-policy", "Return Policy"]] as const) {
    const page = await prisma.contentPage.upsert({ where: { slug }, update: {}, create: { slug, title } });
    await prisma.contentPageVersion.upsert({ where: { pageId_version: { pageId: page.id, version: 1 } }, update: {}, create: { pageId: page.id, version: 1, status: "PUBLISHED", publishedAt: new Date(), content: { heading: title, body: `${title} content will be maintained by the Ruvaya administration team.` } } });
  }
  for (const [key, subject] of [["order_received", "We received your Ruvaya order"], ["payment_successful", "Payment received"], ["password_reset", "Reset your Ruvaya admin password"]] as const) await prisma.notificationTemplate.upsert({ where: { key }, update: {}, create: { key, subject, heading: subject, body: "{{content}}", securityCritical: key === "password_reset" } });
}

main().finally(() => prisma.$disconnect());
