/**
 * Regression: Pluto migration additive-safety (task 17.4, design "Batas
 * Kepemilikan Data dan Migration").
 *
 * Requirement 22.3: partner DB changes on the Main DB MUST be additive — no
 * DROP, no TRUNCATE, no column removal, no rename of existing columns/tables,
 * and no touching of the existing migration history. Requirement 22.5: existing
 * providers/orders keep working, which additive-only guarantees at the schema
 * level.
 *
 * Live-apply note (documented, deferred): applying the migration against a
 * production-like copy requires a running PostgreSQL 17 instance
 * (`prisma migrate deploy` against a real `DATABASE_URL`), which is not
 * available as an in-process, external-service-free fixture in this test
 * environment. Pointing `migrate deploy` at any reachable DB would also risk a
 * destructive/irreversible change to shared data. We therefore assert the
 * additive contract statically against the committed migration SQL, which is
 * the artifact `prisma migrate deploy` would execute verbatim. The live apply +
 * dispatcher smoke against a throwaway DB is exercised by the cross-repo E2E
 * task (17.6) where an ephemeral database is provisioned.
 *
 * This file only READS the migration SQL and asserts against it; it never
 * modifies the migration or any source module.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../.."); // src/lib -> repo root
const MIGRATION_DIR = path.join(
  REPO_ROOT,
  "prisma",
  "migrations",
  "20260615000000_add_partner_pluto_dispatch",
);
const MIGRATION_SQL_PATH = path.join(MIGRATION_DIR, "migration.sql");

const RAW_SQL = readFileSync(MIGRATION_SQL_PATH, "utf8");

/** Strip `-- line comments` and split into non-empty, trimmed SQL statements. */
function parseStatements(sql: string): string[] {
  const withoutLineComments = sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return withoutLineComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const STATEMENTS = parseStatements(RAW_SQL);

/** The executable SQL with `-- comments` removed (documentation prose stripped). */
const CODE_ONLY = STATEMENTS.join(";\n") + ";";

/**
 * Additive statement classifier. Each real statement MUST match exactly one of
 * these additive shapes; anything else is treated as a potential destructive /
 * non-additive change and fails the regression.
 */
const ADDITIVE_SHAPES: Array<{ label: string; re: RegExp }> = [
  { label: "ALTER TABLE ... ADD COLUMN IF NOT EXISTS", re: /^ALTER\s+TABLE\s+.+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/i },
  { label: "CREATE TABLE IF NOT EXISTS", re: /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i },
  { label: "CREATE UNIQUE INDEX IF NOT EXISTS", re: /^CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\b/i },
  { label: "CREATE INDEX IF NOT EXISTS", re: /^CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\b/i },
];

/** Destructive / non-additive patterns that MUST NOT appear anywhere. */
const DESTRUCTIVE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "DROP TABLE", re: /\bDROP\s+TABLE\b/i },
  { label: "DROP COLUMN", re: /\bDROP\s+COLUMN\b/i },
  { label: "DROP INDEX", re: /\bDROP\s+INDEX\b/i },
  { label: "DROP CONSTRAINT", re: /\bDROP\s+CONSTRAINT\b/i },
  { label: "DROP SCHEMA", re: /\bDROP\s+SCHEMA\b/i },
  { label: "DROP DATABASE", re: /\bDROP\s+DATABASE\b/i },
  { label: "TRUNCATE", re: /\bTRUNCATE\b/i },
  { label: "DELETE FROM", re: /\bDELETE\s+FROM\b/i },
  { label: "UPDATE (existing rows)", re: /\bUPDATE\s+"?\w+"?\s+SET\b/i },
  { label: "ALTER ... DROP", re: /\bALTER\s+TABLE[\s\S]*?\bDROP\b/i },
  { label: "RENAME COLUMN", re: /\bRENAME\s+COLUMN\b/i },
  { label: "RENAME TO / RENAME CONSTRAINT", re: /\bRENAME\s+(TO|CONSTRAINT)\b/i },
  { label: "ALTER COLUMN (type/nullability change)", re: /\bALTER\s+COLUMN\b/i },
];

describe("Pluto migration additive-safety (Req 22.3 / 22.5)", () => {
  it("the additive migration file exists at the documented path", () => {
    expect(existsSync(MIGRATION_SQL_PATH)).toBe(true);
    expect(RAW_SQL.length).toBeGreaterThan(0);
    // Sanity: we actually parsed a handful of statements to scan.
    expect(STATEMENTS.length).toBeGreaterThanOrEqual(5);
  });

  it("contains NO destructive or non-additive statements anywhere in the SQL", () => {
    const hits = DESTRUCTIVE_PATTERNS.filter((p) => p.re.test(RAW_SQL)).map((p) => p.label);
    expect(hits).toEqual([]);
  });

  it("every statement matches an additive-only shape", () => {
    for (const stmt of STATEMENTS) {
      const matched = ADDITIVE_SHAPES.some((shape) => shape.re.test(stmt));
      // Attach the offending statement to the assertion message for triage.
      expect(matched, `Non-additive statement encountered:\n${stmt}`).toBe(true);
    }
  });

  it("never touches the Prisma migration history table", () => {
    expect(/_prisma_migrations/i.test(RAW_SQL)).toBe(false);
  });

  it("declares no cross-database reference to the Partner DB", () => {
    // Main must not reference the separate partner database or add FKs to it.
    // Scanned against the executable SQL (comments stripped) — the header
    // comment legitimately mentions the partner DB name only as documentation.
    expect(/kirimkode_partner/i.test(CODE_ONLY)).toBe(false);
    expect(/\bFOREIGN\s+KEY\b/i.test(CODE_ONLY)).toBe(false);
    expect(/\bREFERENCES\b/i.test(CODE_ONLY)).toBe(false);
  });

  it("adds the two order refs as NULLABLE columns via ADD COLUMN IF NOT EXISTS", () => {
    for (const col of ["providerOrderRef", "providerRequestRef"]) {
      const stmt = STATEMENTS.find(
        (s) => /^ALTER\s+TABLE\s+"orders"/i.test(s) && s.includes(`"${col}"`),
      );
      expect(stmt, `missing ADD COLUMN for ${col}`).toBeTruthy();
      // Additive + idempotent guard present.
      expect(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i.test(stmt!)).toBe(true);
      // New column is TEXT and nullable (no NOT NULL / no DEFAULT backfill on
      // the existing `orders` table).
      expect(/\bTEXT\b/i.test(stmt!)).toBe(true);
      expect(/\bNOT\s+NULL\b/i.test(stmt!)).toBe(false);
    }
  });

  it("only mutates the existing `orders` table by ADDING columns/indexes", () => {
    const ordersStatements = STATEMENTS.filter((s) => /"orders"/i.test(s));
    for (const stmt of ordersStatements) {
      const isAddColumn = /^ALTER\s+TABLE\s+"orders"\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i.test(stmt);
      const isCreateIndex = /^CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b[\s\S]*ON\s+"orders"/i.test(stmt);
      expect(
        isAddColumn || isCreateIndex,
        `Statement against existing "orders" table is not purely additive:\n${stmt}`,
      ).toBe(true);
    }
  });

  it("introduces the operations/compensation table as a NEW CREATE TABLE", () => {
    const createTable = STATEMENTS.find((s) =>
      /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"partner_dispatches"/i.test(s),
    );
    expect(createTable, "partner_dispatches CREATE TABLE not found").toBeTruthy();
    // Idempotent create guard + primary key defined on the new table.
    expect(/IF\s+NOT\s+EXISTS/i.test(createTable!)).toBe(true);
    expect(/PRIMARY\s+KEY/i.test(createTable!)).toBe(true);
    // Exactly-once guard: unique purchaseKey index on the new table.
    const uniqueIdx = STATEMENTS.find((s) =>
      /^CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS[\s\S]*ON\s+"partner_dispatches"\("purchaseKey"\)/i.test(s),
    );
    expect(uniqueIdx, "unique purchaseKey index not found").toBeTruthy();
  });

  it("only CREATE-TABLEs brand-new tables (no existing table is recreated/altered destructively)", () => {
    const createdTables = STATEMENTS.filter((s) => /^CREATE\s+TABLE\b/i.test(s)).map((s) => {
      const m = s.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"([^"]+)"/i);
      return m?.[1] ?? "";
    });
    // The migration only creates the new partner_dispatches table.
    expect(createdTables).toEqual(["partner_dispatches"]);
  });
});
