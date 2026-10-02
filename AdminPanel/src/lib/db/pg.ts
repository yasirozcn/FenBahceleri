// PostgreSQL bağlantı havuzu. Uygulamanın geri kalanı bunu doğrudan kullanmaz; yalnızca `repo.ts` üzerinden erişir.
import "server-only";
import { Pool, types, type PoolClient } from "pg";
import { buildSeed } from "./seed";

// bigint (time_slot) varsayılan olarak metin döner; kodda sayı bekleniyor.
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL tanımlı değil. .env.local dosyasına bakın (POSTGRESQL_KURULUM.md).");
}

type PgState = { pool?: Pool; ready?: Promise<void> };
// Next.js geliştirme modunda modüller yeniden yüklenebildiği için havuzu globalde tutuyoruz.
const g = globalThis as unknown as { __fbPg?: PgState };
const state: PgState = g.__fbPg ?? (g.__fbPg = {});

const pool =
  state.pool ??
  (state.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  }));

type Queryable = Pick<PoolClient, "query">;

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** snake_case satırı camelCase nesneye çevirir; tarihleri ISO metnine dönüştürür. */
export function camel<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v instanceof Date ? v.toISOString() : v]),
  ) as T;
}

/** camelCase nesneyi tabloya ekler (kolon adları otomatik snake_case yapılır). */
export async function insertRow(c: Queryable, table: string, row: object): Promise<void> {
  const entries = Object.entries(row);
  const cols = entries.map(([k]) => snake(k));
  const values = entries.map(([k, v]) => ((k === "beforeValue" || k === "afterValue") && v != null ? JSON.stringify(v) : v));
  await c.query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, values);
}

/**
 * Geliştirme kolaylığı: veritabanı boşsa (hiç yönetici yoksa) örnek verileri ekler.
 * Varsayılan: geliştirmede açık, üretimde kapalı. SEED_SAMPLE_DATA=false/true ile değiştirilebilir
 * (true yalnızca test veritabanında, örn. `next start` ile uçtan uca testte kullanılmalı).
 */
async function seedIfEmpty(): Promise<void> {
  const enabled = process.env.SEED_SAMPLE_DATA ? process.env.SEED_SAMPLE_DATA === "true" : process.env.NODE_ENV !== "production";
  if (!enabled) return;
  const { rows } = await pool.query("SELECT 1 FROM admin_users LIMIT 1");
  if (rows.length) return;
  const db = await buildSeed();
  await tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(7426001)"); // aynı anda iki sunucu süreci tohumlamasın
    const again = await c.query("SELECT 1 FROM admin_users LIMIT 1");
    if (again.rows.length) return;
    for (const s of db.students) await insertRow(c, "students", s);
    for (const x of db.guardians) await insertRow(c, "guardians", x);
    for (const x of db.studentGuardians) await insertRow(c, "student_guardians", x);
    for (const x of db.kiosks) await insertRow(c, "kiosks", x);
    for (const x of db.adminUsers) await insertRow(c, "admin_users", x);
  }, false);
  console.log("[db] Boş veritabanına örnek veriler eklendi (src/lib/db/seed.ts).");
}

function ready(): Promise<void> {
  if (!state.ready) {
    state.ready = seedIfEmpty().catch((e) => {
      state.ready = undefined;
      throw e;
    });
  }
  return state.ready;
}

/** Tek sorgu; satırları camelCase döner. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const r = await pool.query(text, params);
  return r.rows.map((row) => camel<T>(row));
}

/** Transaction: fn içindeki tüm sorgular ya birlikte yazılır ya hiç yazılmaz. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>, waitReady = true): Promise<T> {
  if (waitReady) await ready();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
