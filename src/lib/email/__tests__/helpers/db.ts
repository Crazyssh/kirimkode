/**
 * Isolated test-database helper for the email-service property/unit tests.
 *
 * Strategy (Req 11.x supporting infra): every property-based iteration runs
 * inside a Prisma interactive transaction that is ALWAYS rolled back. Nothing
 * is ever committed, so each iteration observes a clean, isolated database
 * state and no test data leaks between iterations or test files.
 *
 * Usage:
 *   await withRollback(async (tx) => {
 *     const user = await tx.user.create({ data: {...} });
 *     // ... exercise service logic against `tx` ...
 *     return someAssertionValue;
 *   });
 *
 * The value returned by the callback is preserved even though the transaction
 * is rolled back afterwards.
 */
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// A dedicated Prisma client for tests. Prefer TEST_DATABASE_URL so a
// throwaway database can be targeted; fall back to DATABASE_URL. Because every
// iteration is rolled back, running against a shared database is still safe.
type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const globalForTestDb = globalThis as unknown as {
  __emailTestPrisma?: PrismaClient;
};

function createTestPrismaClient(): PrismaClient {
  const connectionString =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Neither TEST_DATABASE_URL nor DATABASE_URL is set; cannot run database-backed tests.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Shared test Prisma client (singleton across the vitest worker). */
export const testDb: PrismaClient =
  globalForTestDb.__emailTestPrisma ?? createTestPrismaClient();
globalForTestDb.__emailTestPrisma = testDb;

/** Sentinel error used to force a transaction rollback without surfacing it. */
class RollbackSignal extends Error {
  constructor() {
    super("__ROLLBACK__");
    this.name = "RollbackSignal";
  }
}

/**
 * Run `fn` inside a transaction that is unconditionally rolled back.
 *
 * The transactional client (`tx`) MUST be used for all database access inside
 * `fn` so the work participates in the rollback. The resolved value of `fn` is
 * returned to the caller.
 *
 * If `fn` throws a real error, that error is re-thrown (the transaction is
 * rolled back regardless).
 */
export async function withRollback<T>(
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  let result: T;
  let captured = false;
  try {
    await testDb.$transaction(async (tx) => {
      result = await fn(tx);
      captured = true;
      // Force rollback: nothing from this iteration is persisted.
      throw new RollbackSignal();
    });
  } catch (err) {
    if (!(err instanceof RollbackSignal)) {
      throw err;
    }
  }
  if (!captured) {
    // Should be unreachable: RollbackSignal is only thrown after result is set.
    throw new Error("withRollback: callback did not complete before rollback");
  }
  // Non-null assertion is safe: `captured` guarantees `result` was assigned.
  return result!;
}

/** Disconnect the shared test client. Call from a global afterAll if desired. */
export async function disconnectTestDb(): Promise<void> {
  await testDb.$disconnect();
  globalForTestDb.__emailTestPrisma = undefined;
}

export type { TxClient };
