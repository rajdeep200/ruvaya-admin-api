import "server-only";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/http/api";
import { hashToken } from "./crypto";

export async function enforceRateLimit(scope: string, key: string, limit: number, windowMs = 60_000) {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const record = await prisma.rateLimitRecord.upsert({
    where: { scope_keyHash_windowStart: { scope, keyHash: hashToken(key), windowStart } },
    create: { scope, keyHash: hashToken(key), windowStart },
    update: { count: { increment: 1 } },
  });
  if (record.count > limit) throw new ApiError("RATE_LIMITED", "Too many requests; retry later", 429);
}
