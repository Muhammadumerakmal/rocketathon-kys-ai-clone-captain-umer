import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs build script without types
import { buildSetupSql } from "../../scripts/build-setup-sql.mjs";

const setup = readFileSync(new URL("../../supabase/setup.sql", import.meta.url), "utf8");

describe("supabase/setup.sql", () => {
  it("is up to date with migrations + seed (run `npm run db:setup-sql`)", () => {
    expect(setup.replace(/\r\n/g, "\n")).toBe((buildSetupSql() as string).replace(/\r\n/g, "\n"));
  });

  it("runs as a single paste on a fresh Supabase-like database", async () => {
    const db = await PGlite.create({ extensions: { vector } });
    await db.exec(`
      create schema auth; create schema extensions;
      create role anon nologin; create role authenticated nologin;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    await db.exec(setup);
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.training_questions");
    expect(rows[0]!.n).toBe(12);
    await db.close();
  }, 60_000);
});
