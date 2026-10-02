// Geçici JSON veritabanındaki (data/db.json) verileri PostgreSQL'e aktarır.
// Kullanım (POSTGRESQL_KURULUM.md, Adım 6):
//   DATABASE_URL=postgres://... node scripts/json-to-postgres.mjs
// Tablolar önceden db/schema.sql ile oluşturulmuş olmalı. Tüm aktarım tek transaction'dır:
// bir hata olursa hiçbir şey yazılmaz.
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const snake = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// Sıra önemli: önce başka tabloların referans verdiği tablolar.
const TABLES = [
  ["students", "students"],
  ["guardians", "guardians"],
  ["studentGuardians", "student_guardians"],
  ["devices", "devices"],
  ["kiosks", "kiosks"],
  ["scanAttempts", "scan_attempts"],
  ["attendanceEvents", "attendance_events"],
  ["smsMessages", "sms_messages"],
  ["permissions", "permissions"],
  ["adminUsers", "admin_users"],
  ["auditLogs", "audit_logs"],
];
const JSON_COLUMNS = new Set(["before_value", "after_value"]);

/** `client` : pg.Client (veya aynı `query(text, params)` arayüzüne sahip bir istemci). */
export async function importData(client, db) {
  const counts = {};
  for (const [key, table] of TABLES) {
    const rows = db[key] ?? [];
    for (const row of rows) {
      const cols = Object.keys(row).map(snake);
      const values = Object.values(row).map((v, i) => (JSON_COLUMNS.has(cols[i]) && v != null ? JSON.stringify(v) : v));
      const params = cols.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${params}) ON CONFLICT DO NOTHING`, values);
    }
    counts[table] = rows.length;
  }
  return counts;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL tanımlı değil. Örnek: DATABASE_URL=postgres://fb_app:sifre@localhost:5432/fenbahceleri");
    process.exit(1);
  }
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const file = path.join(process.env.DATA_DIR ?? path.join(root, "data"), "db.json");
  const db = JSON.parse(await readFile(file, "utf8"));
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const counts = await importData(client, db);
    await client.query("COMMIT");
    console.table(counts);
    console.log("Aktarım tamamlandı.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Aktarım başarısız, hiçbir değişiklik yapılmadı:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
