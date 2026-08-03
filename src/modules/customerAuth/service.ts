import "server-only";
import argon2 from "argon2";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db/prisma";
import { hashToken, randomToken } from "@/lib/security/crypto";
import { ApiError } from "@/lib/http/api";
import { env } from "@/config/env";
import { sendEmail } from "@/lib/email/resend";
import { paiseToRupees } from "@/lib/money";

// Consumer session — longer-lived than the admin dashboard's 8h session,
// since re-logging in on every storefront visit would be poor UX.
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

type AccountRecord = { id: string; email: string; name: string; phone: string | null };

function publicAccount(account: AccountRecord) {
  return { id: account.id, email: account.email, name: account.name, phone: account.phone };
}

async function issueSession(accountId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.accountSession.create({ data: { tokenHash: hashToken(token), accountId, expiresAt } });
  return { token, expiresAt };
}

export async function signUp(email: string, password: string, name: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.account.findUnique({ where: { email: normalized } });
  if (existing) throw new ApiError("CONFLICT", "An account with this email already exists", 409);
  const passwordHash = await argon2.hash(password, ARGON2_OPTS);
  const account = await prisma.account.create({ data: { email: normalized, passwordHash, name: name.trim() } });
  const session = await issueSession(account.id);
  return { ...session, account: publicAccount(account) };
}

export async function login(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const account = await prisma.account.findUnique({ where: { email: normalized } });
  if (!account || !account.passwordHash || !(await argon2.verify(account.passwordHash, password))) {
    throw new ApiError("UNAUTHORIZED", "Invalid email or password", 401);
  }
  const session = await issueSession(account.id);
  return { ...session, account: publicAccount(account) };
}

export async function loginWithGoogle(idToken: string) {
  if (!env.GOOGLE_CLIENT_ID) throw new ApiError("NOT_CONFIGURED", "Google sign-in is not configured", 503);
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: env.GOOGLE_CLIENT_ID,
    }));
  } catch {
    throw new ApiError("UNAUTHORIZED", "Invalid Google sign-in token", 401);
  }
  const googleId = payload.sub;
  const email = String(payload.email ?? "").trim().toLowerCase();
  if (!googleId || !email || !payload.email_verified) {
    throw new ApiError("UNAUTHORIZED", "Google account email is not verified", 401);
  }
  const name = typeof payload.name === "string" && payload.name ? payload.name : email.split("@")[0];

  let account = await prisma.account.findUnique({ where: { googleId } });
  if (!account) account = await prisma.account.findUnique({ where: { email } });
  if (account) {
    if (!account.googleId) account = await prisma.account.update({ where: { id: account.id }, data: { googleId } });
  } else {
    account = await prisma.account.create({ data: { email, googleId, name } });
  }
  const session = await issueSession(account.id);
  return { ...session, account: publicAccount(account) };
}

function bearerToken(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

export async function getAccountFromToken(token: string | undefined) {
  if (!token) return null;
  return prisma.account.findFirst({
    where: { sessions: { some: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } } } },
  });
}

export async function requireAccount(request: Request) {
  const account = await getAccountFromToken(bearerToken(request));
  if (!account) throw new ApiError("UNAUTHORIZED", "Login required", 401);
  return account;
}

export async function logout(request: Request) {
  const token = bearerToken(request);
  if (!token) return;
  await prisma.accountSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function updateProfile(accountId: string, data: { name?: string; phone?: string | null }) {
  const account = await prisma.account.update({ where: { id: accountId }, data });
  return publicAccount(account);
}

export async function requestPasswordReset(email: string) {
  const account = await prisma.account.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!account) return null;
  const token = randomToken();
  await prisma.accountPasswordResetToken.create({
    data: { tokenHash: hashToken(token), accountId: account.id, expiresAt: new Date(Date.now() + 30 * 60_000) },
  });
  const resetUrl = `${env.STOREFRONT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail({
    to: account.email,
    subject: "Reset your Ruvaya password",
    html: `<p>Hi ${account.name},</p><p>Click below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });
  // Falls back to returning the raw token in development when no email provider is configured.
  return !sent && process.env.NODE_ENV === "development" ? token : null;
}

export async function resetPassword(token: string, password: string) {
  if (password.length < 8) throw new ApiError("VALIDATION_ERROR", "Password must be at least 8 characters", 422);
  const record = await prisma.accountPasswordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new ApiError("AUTH_EXPIRED", "Reset link is invalid or expired", 401);
  }
  const passwordHash = await argon2.hash(password, ARGON2_OPTS);
  await prisma.$transaction([
    prisma.account.update({ where: { id: record.accountId }, data: { passwordHash } }),
    prisma.accountPasswordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.accountSession.updateMany({ where: { accountId: record.accountId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

// Mirrors the storefront-facing product media include (src/modules/products/service.ts
// `publicInclude.media`) — same "confirmed, non-deleted, primary first" ordering, but
// capped to the single primary image since order previews only ever need one thumbnail.
const ORDER_ITEM_PRIMARY_MEDIA_INCLUDE = {
  where: { deletedAt: null, uploadStatus: "CONFIRMED" as const },
  orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }],
  take: 1,
};

const REVIEW_TOKEN_TTL_MS = 24 * 60 * 60_000;

// One review invitation per order item (ReviewToken.orderItemId is unique). For a
// delivered order, mints/rotates a fresh raw token per unreviewed item on every
// lookup — same rotate-on-lookup shape as trackOrder()'s Order.secureTokenHash — so
// the "Rate your experience" widget on the order-detail page always has a live,
// unexpired token to link to. Items already reviewed (ReviewToken.usedAt set) are
// left untouched and get no token back.
async function attachReviewTokens(order: { status: string; items: { id: string }[] }) {
  if (order.status !== "DELIVERED") return order.items.map(() => null);
  return Promise.all(
    order.items.map(async (item) => {
      const existing = await prisma.reviewToken.findUnique({ where: { orderItemId: item.id } });
      if (existing?.usedAt) return null;
      const token = randomToken();
      await prisma.reviewToken.upsert({
        where: { orderItemId: item.id },
        create: { orderItemId: item.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + REVIEW_TOKEN_TTL_MS) },
        update: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + REVIEW_TOKEN_TTL_MS) },
      });
      return token;
    }),
  );
}

export async function listMyOrders(accountId: string) {
  const orders = await prisma.order.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: { include: { media: ORDER_ITEM_PRIMARY_MEDIA_INCLUDE } } } },
    },
  });
  return orders.map((order) => {
    const previewSource = order.items[0];
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: paiseToRupees(order.totalPaise),
      currency: order.currency,
      itemCount: order.items.length,
      createdAt: order.createdAt,
      previewItem: previewSource
        ? { productName: previewSource.productName, imageUrl: previewSource.product.media[0]?.secureUrl ?? null }
        : null,
    };
  });
}

export async function getMyOrder(accountId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, accountId },
    include: {
      items: { include: { product: { include: { media: ORDER_ITEM_PRIMARY_MEDIA_INCLUDE } } } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) throw new ApiError("NOT_FOUND", "Order not found", 404);
  const reviewTokens = await attachReviewTokens(order);
  // Shaped DTO — the raw Order row also carries secureTokenHash,
  // paymentCapabilityHash, idempotencyKey etc., which must never reach the client.
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: paiseToRupees(order.subtotalPaise),
    discount: paiseToRupees(order.discountPaise),
    shipping: paiseToRupees(order.shippingPaise),
    total: paiseToRupees(order.totalPaise),
    currency: order.currency,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    items: order.items.map((item, i) => ({
      id: item.id,
      productName: item.productName,
      imageUrl: item.product.media[0]?.secureUrl ?? null,
      sku: item.sku,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: paiseToRupees(item.unitPricePaise),
      total: paiseToRupees(item.totalPaise),
      reviewToken: reviewTokens[i],
    })),
    statusHistory: order.statusHistory.map((entry) => ({
      id: entry.id,
      toStatus: entry.toStatus,
      reason: entry.reason,
      createdAt: entry.createdAt,
    })),
  };
}
