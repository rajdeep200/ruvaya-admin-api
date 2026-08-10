import "server-only";
import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaTx?: PrismaClient };
const logLevels: ("warn" | "error")[] = process.env.NODE_ENV === "development" ? ["warn","error"] : ["error"];

// Pooled (transaction-mode PgBouncer) connection for ordinary queries — scales to many
// concurrent short-lived connections, which is most of the app's traffic.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: logLevels });

// Session-mode connection reserved for multi-statement interactive transactions
// (prisma.$transaction(async (tx) => ...)), which transaction-mode PgBouncer cannot
// safely run: the pooler can swap the underlying connection between statements,
// breaking the transaction mid-flight. Session-mode has a much smaller connection
// limit, so only call sites that truly need an interactive transaction should use this.
export const prismaTx = globalForPrisma.prismaTx ?? new PrismaClient({ log: logLevels, datasourceUrl: env.DIRECT_URL });

if (process.env.NODE_ENV !== "production") { globalForPrisma.prisma = prisma; globalForPrisma.prismaTx = prismaTx; }
