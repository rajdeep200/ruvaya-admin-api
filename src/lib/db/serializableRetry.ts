import "server-only";
import { Prisma } from "@prisma/client";

/** Postgres SERIALIZABLE transactions are expected to occasionally abort
 * under concurrent writes to overlapping rows (e.g. a webhook and a status
 * poll landing on the same payment within milliseconds) - Postgres's own
 * docs require the application to retry those, it isn't an application bug.
 * Prisma surfaces this as P2034. Retrying here, close to the failure, is far
 * cheaper than relying on the caller's own retry (e.g. Cashfree re-sending a
 * failed webhook only after several minutes). */
export async function withSerializableRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!isConflict || attempt >= attempts) throw error;
      const backoffMs = 30 * 2 ** (attempt - 1) + Math.floor(Math.random() * 30);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}
