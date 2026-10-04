// Yönetici veya kiosk hesabı oluşturur / şifresini değiştirir (canlıda ilk kurulum için).
// Kullanım (sunucuda):
//   docker compose exec app node scripts/create-admin.mjs --email admin@okul.com --name "Okul Yöneticisi" --role ADMIN
//   docker compose exec app node scripts/create-admin.mjs --email kapi@okul.com --name "Ana Kapı Tableti" --role KIOSK
// Şifre sorulur (ekranda görünmez). Aynı e-posta varsa şifresi ve adı güncellenir.
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const email = args.email?.trim().toLowerCase();
const name = args.name?.trim() || "Okul Yöneticisi";
const role = (args.role ?? "ADMIN").toUpperCase();
if (!email || !["ADMIN", "KIOSK"].includes(role)) {
  console.error('Kullanım: node scripts/create-admin.mjs --email e@posta.com --name "Ad Soyad" --role ADMIN|KIOSK');
  process.exit(1);
}

async function askPassword(label) {
  process.stdout.write(label);
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    const chunks = [];
    for await (const c of stdin) chunks.push(c);
    return Buffer.concat(chunks).toString().trim();
  }
  stdin.setRawMode(true);
  stdin.resume();
  let pw = "";
  return new Promise((resolve) => {
    stdin.on("data", function onData(buf) {
      for (const ch of buf.toString()) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(pw);
        }
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f") pw = pw.slice(0, -1);
        else pw += ch;
      }
    });
  });
}

const password = process.env.ADMIN_PASSWORD ?? (await askPassword(`${email} için şifre (en az 10 karakter): `));
if (password.length < 10) {
  console.error("Şifre en az 10 karakter olmalı.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
});
await client.connect();
try {
  const hash = await bcrypt.hash(password, 10);
  const r = await client.query(
    `INSERT INTO admin_users (id, full_name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ((lower(email))) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
     RETURNING (xmax = 0) AS created`,
    [`adm_${randomBytes(6).toString("hex")}`, name, email, role, hash],
  );
  console.log(`${r.rows[0].created ? "Oluşturuldu" : "Güncellendi"}: ${email} (${role})`);
} finally {
  await client.end();
}
