/**
 * Sanity test for the email-service test tooling (task 1.2).
 *
 * Verifies that:
 *  - vitest runs and reports results,
 *  - fast-check is wired up and can drive property checks,
 *  - the MockSmtpSender helper simulates success / failure / throw,
 *  - the isolated test-database rollback helper leaves no committed state
 *    (skipped automatically when no database is reachable).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fc from "fast-check";
import { createMockSmtpSender } from "./helpers/mock-smtp";
import { withRollback, testDb, disconnectTestDb } from "./helpers/db";

describe("test tooling sanity", () => {
  it("runs a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("drives a fast-check property", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 },
    );
  });
});

describe("MockSmtpSender", () => {
  it("records and resolves successful sends", async () => {
    const smtp = createMockSmtpSender({ behavior: "success" });
    const res = await smtp.send({
      to: "a@example.com",
      subject: "s",
      html: "<p>h</p>",
      text: "h",
    });
    expect(res.ok).toBe(true);
    expect(smtp.attempts).toHaveLength(1);
    expect(smtp.sent).toHaveLength(1);
    expect(smtp.failed).toHaveLength(0);
  });

  it("simulates delivery failure with a reason", async () => {
    const smtp = createMockSmtpSender({ behavior: "fail", failReason: "nope" });
    const res = await smtp.send({
      to: "b@example.com",
      subject: "s",
      html: "h",
      text: "h",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("nope");
    expect(smtp.failed).toHaveLength(1);
  });

  it("simulates a hard connection error via throw", async () => {
    const smtp = createMockSmtpSender({ behavior: "throw" });
    await expect(
      smtp.send({ to: "c@example.com", subject: "s", html: "h", text: "h" }),
    ).rejects.toThrow(/mock smtp/i);
    expect(smtp.failed).toHaveLength(1);
  });

  it("supports a per-email decision function", async () => {
    const smtp = createMockSmtpSender({
      behavior: (email) =>
        email.to.endsWith("@bad.com")
          ? { ok: false, reason: "blocked" }
          : { ok: true },
    });
    const ok = await smtp.send({ to: "x@good.com", subject: "", html: "", text: "" });
    const bad = await smtp.send({ to: "y@bad.com", subject: "", html: "", text: "" });
    expect(ok.ok).toBe(true);
    expect(bad.ok).toBe(false);
    expect(smtp.attempts).toHaveLength(2);
  });
});

// Database-backed rollback isolation. Skips gracefully if no DB is reachable so
// tooling verification does not depend on a running Postgres instance.
describe("withRollback (isolated test database)", () => {
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await testDb.$queryRawUnsafe("SELECT 1");
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await disconnectTestDb();
    }
  });

  it("returns the callback value and rolls back all writes", async () => {
    if (!dbAvailable) {
      // No database configured/reachable in this environment.
      return;
    }

    const email = `rollback-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

    const createdId = await withRollback(async (tx) => {
      const user = await tx.user.create({ data: { email } });
      const found = await tx.user.findUnique({ where: { email } });
      expect(found?.id).toBe(user.id);
      return user.id;
    });

    expect(typeof createdId).toBe("string");

    // After rollback the user must NOT exist in a committed state.
    const afterRollback = await testDb.user.findUnique({ where: { email } });
    expect(afterRollback).toBeNull();
  });
});
