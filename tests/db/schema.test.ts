import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the REAL migrations + seed on Postgres (PGlite = Postgres in WASM, with pgvector)
 * and checks the security-critical behaviour: RLS isolation, sealed memories,
 * time-travel search, the atomic correction loop, append-only / server-only tables.
 */

const root = new URL("../../supabase/", import.meta.url);
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";

// Minimal stand-in for what Supabase provides before our migrations run.
const SUPABASE_STUB = `
  create schema if not exists auth;
  create schema if not exists extensions;
  create role anon nologin;
  create role authenticated nologin;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, extensions, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

let db: PGlite;

/** Run `fn` as a signed-in user (role authenticated + JWT sub), like PostgREST does. */
async function asUser<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);` : "set role anon;");
  try {
    return await fn();
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}

const rows = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { vector } });
  await db.exec(SUPABASE_STUB);
  const migrations = readdirSync(new URL("migrations/", root)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of migrations) {
    try {
      await db.exec(readFileSync(new URL(`migrations/${f}`, root), "utf8"));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
  // Two users; the sign-up trigger should create their profiles.
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@test.dev'), ('${B}', 'b@test.dev');`);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("schema", () => {
  it("applies all migrations and the seed", async () => {
    const [q] = await rows<{ n: number }>("select count(*)::int as n from training_questions");
    expect(q!.n).toBe(12);
    const [r] = await rows<{ n: number }>("select count(*)::int as n from training_questions where is_retest");
    expect(r!.n).toBe(5);
  });

  it("seed is idempotent", async () => {
    await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
    const [q] = await rows<{ n: number }>("select count(*)::int as n from training_questions");
    expect(q!.n).toBe(12);
  });

  it("creates a profile for every new auth user", async () => {
    const r = await rows<{ display_name: string }>("select display_name from profiles order by display_name");
    expect(r.map((x) => x.display_name)).toEqual(["a", "b"]);
  });
});

describe("row-level security", () => {
  it("user B cannot read user A's memories, by table or by search RPC", async () => {
    await asUser(A, () => db.query("insert into memories (user_id, content, kind) values ($1, 'A secret plan about Lisbon', 'semantic')", [A]));
    const mine = await asUser(A, () => rows("select id from memories"));
    const theirs = await asUser(B, () => rows("select id from memories"));
    const rpc = await asUser(B, () => rows("select * from match_memories('Lisbon', null, 10)"));
    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(0);
    expect(rpc).toHaveLength(0);
  });

  it("anonymous users see nothing", async () => {
    expect(await asUser(null, () => rows("select id from memories"))).toHaveLength(0);
  });

  it("a user cannot insert rows owned by someone else", async () => {
    await expect(asUser(B, () => db.query("insert into memories (user_id, content, kind) values ($1, 'forged', 'semantic')", [A]))).rejects.toThrow(
      /row-level security/i,
    );
  });

  it("server-only tables are closed to clients", async () => {
    expect(await asUser(A, () => rows("select * from paused_runs"))).toHaveLength(0);
    await expect(
      asUser(A, () => db.query("insert into paused_runs (user_id, serialized_state, expires_at) values ($1, 'x', now())", [A])),
    ).rejects.toThrow(/row-level security/i);
    await expect(asUser(A, () => db.query("insert into usage_budget (user_id, tokens_in) values ($1, -999999)", [A]))).rejects.toThrow();
  });

  it("audit log is append-only", async () => {
    await asUser(A, () => db.query("insert into audit_logs (user_id, event_type) values ($1, 'test')", [A]));
    const updated = await asUser(A, () => db.query("update audit_logs set event_type = 'tampered'"));
    const deleted = await asUser(A, () => db.query("delete from audit_logs"));
    expect(updated.affectedRows).toBe(0);
    expect(deleted.affectedRows).toBe(0);
  });
});

describe("sealed memories (F12)", () => {
  it("a sealed memory never keeps an embedding, even if one is supplied", async () => {
    const vec = `[${Array.from({ length: 1536 }, () => 0.01).join(",")}]`;
    const [m] = await asUser(A, () =>
      rows<{ has_embedding: boolean }>(
        "insert into memories (user_id, content, kind, influence, embedding) values ($1, 'journal', 'episodic', 'sealed', $2) returning embedding is not null as has_embedding",
        [A, vec],
      ),
    );
    expect(m!.has_embedding).toBe(false);
  });

  it("sealed memories are invisible to retrieval", async () => {
    await asUser(A, () => db.query("insert into memories (user_id, content, kind, influence) values ($1, 'therapy notes about anxiety', 'episodic', 'sealed')", [A]));
    const hits = await asUser(A, () => rows("select id from match_memories('therapy anxiety', null, 10)"));
    expect(hits).toHaveLength(0);
  });
});

describe("time-travel retrieval (F5)", () => {
  it("returns the belief that was true at the as_of date", async () => {
    await asUser(A, async () => {
      const [oldM] = await rows<{ id: string }>(
        "insert into memories (user_id, content, kind, valid_from) values ($1, 'I love risky bets and career gambles', 'value', '2024-01-01') returning id",
        [A],
      );
      const [newM] = await rows<{ id: string }>(
        "insert into memories (user_id, content, kind, valid_from) values ($1, 'I now value stability over career gambles', 'value', '2026-09-01') returning id",
        [A],
      );
      await db.query("update memories set valid_to = '2026-09-01', superseded_by = $2 where id = $1", [oldM!.id, newM!.id]);
    });
    const spring = await asUser(A, () => rows<{ content: string }>("select content from match_memories('career gambles', null, 10, '2026-04-01')"));
    const today = await asUser(A, () => rows<{ content: string }>("select content from match_memories('career gambles', null, 10)"));
    expect(spring.map((r) => r.content)).toEqual(["I love risky bets and career gambles"]);
    expect(today.map((r) => r.content)).toEqual(["I now value stability over career gambles"]);
  });
});

describe("resolve_prediction (atomic correction loop)", () => {
  let predictionId: string;

  beforeAll(async () => {
    const [p] = await asUser(A, () =>
      rows<{ id: string }>(
        `insert into predictions (user_id, scenario, options, category, distribution, top_choice, baseline_choice,
                                  baseline_agrees, confidence, confidence_band, prompt_version, model)
         values ($1, 'Lisbon or Berlin?', '["Lisbon","Berlin"]', 'lifestyle', '{"Lisbon":0.8,"Berlin":0.2}',
                 'Lisbon', 'Berlin', false, 0.7, 'high', 'predict@1', 'test') returning id`,
        [A],
      ),
    );
    predictionId = p!.id;
  });

  it("another user cannot resolve my prediction", async () => {
    await expect(asUser(B, () => db.query("select resolve_prediction($1, 'correct', 'Lisbon')", [predictionId]))).rejects.toThrow(/not found/);
  });

  it("writes feedback, calibration and an outcome check-in in one step", async () => {
    await asUser(A, () => db.query("select resolve_prediction($1, 'wrong', 'Berlin')", [predictionId]));
    const [s] = await asUser(A, () => rows<{ n: number; hits: number; baseline_hits: number; brier_sum: number }>("select n, hits, baseline_hits, brier_sum from calibration_stats where category = 'lifestyle'"));
    expect(s).toMatchObject({ n: 1, hits: 0, baseline_hits: 1 });
    expect(s!.brier_sum).toBeCloseTo(0.49, 2);
    expect(await asUser(A, () => rows("select id from outcomes"))).toHaveLength(1);
    const [p] = await asUser(A, () => rows<{ status: string }>("select status from predictions where id = $1", [predictionId]));
    expect(p!.status).toBe("resolved");
  });

  it("refuses to resolve twice", async () => {
    await expect(asUser(A, () => db.query("select resolve_prediction($1, 'correct', 'Lisbon')", [predictionId]))).rejects.toThrow(/already resolved/);
  });

  it("clients cannot fake their track record directly", async () => {
    await expect(asUser(A, () => db.query("insert into calibration_stats (user_id, category, n, hits) values ($1, 'money', 100, 100)", [A]))).rejects.toThrow(
      /row-level security/i,
    );
  });
});

describe("set_pivotal_evidence (F3)", () => {
  const E1 = "00000000-0000-4000-8000-00000000e001";
  const E2 = "00000000-0000-4000-8000-00000000e002";
  let id: string;

  beforeAll(async () => {
    const [p] = await asUser(A, () =>
      rows<{ id: string }>(
        `insert into predictions (user_id, scenario, options, distribution, top_choice, baseline_choice, baseline_agrees,
                                  confidence, confidence_band, prompt_version, model, evidence)
         values ($1, 'x?', '["a","b"]', '{"a":1}', 'a', 'b', false, 0.6, 'medium', 'p', 'm',
                 $2::jsonb) returning id`,
        [A, JSON.stringify([{ id: E1, type: "memory", label: "one", relevance: 1 }, { id: E2, type: "value", label: "two", relevance: 0.5 }])],
      ),
    );
    id = p!.id;
  });

  it("flips only pivotal flags, preserving order and other fields", async () => {
    const [r] = await asUser(A, () => rows<{ ev: { id: string; pivotal: boolean; label: string }[] }>("select set_pivotal_evidence($1, $2) as ev", [id, [E2]]));
    expect(r!.ev.map((e) => [e.id, e.pivotal, e.label])).toEqual([
      [E1, false, "one"],
      [E2, true, "two"],
    ]);
  });

  it("another user cannot touch my prediction", async () => {
    await expect(asUser(B, () => db.query("select set_pivotal_evidence($1, $2)", [id, [E1]]))).rejects.toThrow(/not found/);
  });

  it("clients still cannot update predictions directly", async () => {
    const r = await asUser(A, () => db.query("update predictions set confidence = 0.95 where id = $1", [id]));
    expect(r.affectedRows).toBe(0);
  });
});

describe("record_usage", () => {
  it("only ever adds non-negative usage", async () => {
    await asUser(A, () => db.query("select record_usage(100, 50)"));
    await asUser(A, () => db.query("select record_usage(10, 5)"));
    const [u] = await asUser(A, () => rows<{ tokens_in: number; tokens_out: number }>("select tokens_in::int, tokens_out::int from usage_budget"));
    expect(u).toEqual({ tokens_in: 110, tokens_out: 55 });
    await expect(asUser(A, () => db.query("select record_usage(-1000, 0)"))).rejects.toThrow(/non-negative/);
  });
});
