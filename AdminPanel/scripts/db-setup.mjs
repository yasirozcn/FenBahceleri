// db/schema.sql'i DATABASE_URL'deki veritabanına uygular (tekrar çalıştırılabilir; var olan veriye dokunmaz).
// Kullanım:
//   npm run db:setup            → tabloları oluştur
//   npm run db:reset            → TÜM TABLOLARI SİL ve yeniden oluştur (yalnızca yerel geliştirme!)
// Canlı sunucuda: DATABASE_URL=... DATABASE_SSL=true node scripts/db-setup.mjs
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL tanımlı değil (.env.local).");
  process.exit(1);
}
const reset = process.argv.includes("--reset");
if (reset && process.env.NODE_ENV === "production") {
  console.error("--reset üretimde çalıştırılamaz.");
  process.exit(1);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schema = await readFile(path.join(root, "db", "schema.sql"), "utf8");
const client = new pg.Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
});
await client.connect();
try {
  if (reset) {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    console.log("Tüm tablolar silindi.");
  }
  await client.query(schema);
  const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1");
  console.log(`Şema uygulandı: ${rows.length} tablo (${rows.map((r) => r.tablename).join(", ")})`);
  if (reset) console.log("Çalışan sunucuyu (npm run dev) yeniden başlatın; ilk istekte örnek veriler eklenir (src/lib/db/seed.ts).");
} finally {
  await client.end();
}
