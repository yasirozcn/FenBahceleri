# PostgreSQL — yerel kurulum ve canlıya alma

AdminPanel verileri PostgreSQL'de tutar. Uygulama veritabanına yalnızca `src/lib/db/repo.ts` üzerinden erişir; bağlantı havuzu `src/lib/db/pg.ts`, tablolar `db/schema.sql` içindedir.

| Dosya | Ne işe yarar |
| --- | --- |
| `docker-compose.yml` | Yerel geliştirme için PostgreSQL 17 (Docker) |
| `db/schema.sql` | Tüm tablolar, kısıtlar ve indeksler (tekrar çalıştırılabilir) |
| `scripts/db-setup.mjs` | Şemayı `DATABASE_URL`'deki veritabanına uygular |
| `scripts/json-to-postgres.mjs` | Eski `data/db.json` verilerini aktarır (tek seferlik) |
| `src/lib/db/seed.ts` | Geliştirmede boş veritabanına eklenen örnek veriler (üretimde çalışmaz) |

---

## Yerel geliştirme

Gerekenler: Docker Desktop (açık olmalı), Node.js 20+.

```bash
cp .env.example .env.local
# .env.local içinde doldurun:
#   AUTH_SECRET        → openssl rand -hex 32
#   POSTGRES_PASSWORD  → openssl rand -hex 16
#   DATABASE_URL       → postgres://fb_app:<POSTGRES_PASSWORD>@localhost:5432/fenbahceleri
#   COOKIE_SECURE=false

npm run db:up       # PostgreSQL konteynerini başlatır (veriler Docker volume'unda kalıcıdır)
npm run db:setup    # tabloları oluşturur
npm run dev         # ilk istekte örnek veriler eklenir
```

| Komut | Açıklama |
| --- | --- |
| `npm run db:up` / `db:down` | Veritabanını başlat / durdur (veri silinmez) |
| `npm run db:setup` | Şemayı uygula (yeni tablo/indeks eklendiğinde tekrar çalıştırın) |
| `npm run db:reset` | **Tüm veriyi siler**, şemayı yeniden kurar. Sonra `npm run dev`'i yeniden başlatın. |
| `npm run db:psql` | Veritabanına SQL konsoluyla bağlan |
| `npm run db:import` | `data/db.json` → PostgreSQL aktarımı |

Veriyi tamamen silmek için (volume dahil): `docker compose --env-file .env.local down -v`.

> Not: `POSTGRES_PASSWORD` yalnızca konteyner **ilk kez** oluşturulurken kullanılır. Sonradan değiştirirseniz `down -v` ile volume'u silip yeniden kurmanız gerekir.

---

## Canlıya alma

### 1. Yönetilen PostgreSQL açın

Veritabanını kendi sunucunuzda Docker ile çalıştırmak yerine yönetilen bir servis kullanın; yedekleme, güncelleme ve disk sorunlarını servis üstlenir. Öğrenci verisi (KVKK) nedeniyle veritabanının **Türkiye'de veya AB'de (ör. Frankfurt)** barınmasına dikkat edin.

Örnek seçenekler: AWS RDS (eu-central-1), DigitalOcean Managed PostgreSQL (Frankfurt), Supabase / Neon (AB bölgesi), Türk sağlayıcıların yönetilen PostgreSQL hizmetleri. PostgreSQL 15+ yeterlidir (yerelde 17).

Servis size bir bağlantı adresi verir:

```
postgres://KULLANICI:ŞİFRE@db-xxxx.sağlayıcı.com:5432/VERİTABANI?sslmode=require
```

Önerilen: panelden `fenbahceleri` adında veritabanı ve yalnızca bu veritabanına yetkili `fb_app` kullanıcısı açın; yönetici (superuser) hesabını uygulamada kullanmayın.

### 2. Sunucunun ortam değişkenleri

Canlıda `.env.local` dosyası yerine barındırma panelinin "Environment Variables" bölümüne girin:

| Değişken | Canlı değeri |
| --- | --- |
| `DATABASE_URL` | Sağlayıcının verdiği adres |
| `DATABASE_SSL` | `true` (sağlayıcı kendi imzalı sertifika kullanıyorsa ek olarak `DATABASE_SSL_REJECT_UNAUTHORIZED=false`) |
| `AUTH_SECRET` | **Yeni** üretin: `openssl rand -hex 32` — yereldekini kullanmayın |
| `COOKIE_SECURE` | `true` |
| `NODE_ENV` | `production` (çoğu barındırma otomatik ayarlar; örnek veri eklenmesini de kapatır) |
| `BLE_REQUIRED`, `SMS_PROVIDER`, `SCHOOL_SHORT_NAME` | Yereldeki gibi |

`POSTGRES_PASSWORD` canlıda kullanılmaz (yalnızca yerel Docker içindir).

### 3. Tabloları oluşturun

Kendi Mac'inizden, canlı adresle bir kez:

```bash
DATABASE_URL="postgres://...canlı adres..." DATABASE_SSL=true node scripts/db-setup.mjs
```

Şemada değişiklik olduğunda aynı komutu tekrar çalıştırın (`IF NOT EXISTS`; var olan veriye dokunmaz). Kolon değiştirme/silme gibi değişiklikler için ileride bir migration aracına (ör. `node-pg-migrate`) geçin.

### 4. İlk yönetici hesabı

Canlıda örnek veriler eklenmez; ilk yöneticiyi elle açın:

```bash
node -e "require('bcryptjs').hash(process.argv[1], 10).then(console.log)" 'GucluBirSifre'
```

```sql
-- psql "postgres://...canlı adres..."
INSERT INTO admin_users (id, full_name, email, role, password_hash)
VALUES ('adm_ilk', 'Okul Yöneticisi', 'admin@okulunuz.com', 'ADMIN', '<yukarıdaki çıktı>');

-- Kiosk tableti için ayrı hesap (web paneline giremez, yalnızca uygulamada QR ekranını açar)
INSERT INTO admin_users (id, full_name, email, role, password_hash)
VALUES ('adm_kiosk1', 'Ana Kapı Tableti', 'kapi@okulunuz.com', 'KIOSK', '<ayrı şifrenin özeti>');

-- Kiosklar (secret her kiosk için rastgele: openssl rand -hex 32)
INSERT INTO kiosks (id, name, direction, secret) VALUES
  ('kiosk_giris', 'Ana Kapı Giriş', 'ENTRY', '<rastgele>'),
  ('kiosk_cikis', 'Ana Kapı Çıkış', 'EXIT',  '<rastgele>');
```

Öğrenciler panelden (Öğrenciler sayfası) eklenir.

### 5. Kontrol listesi

- Günlük otomatik yedek açık mı? Ayda bir geri yükleme testi yapın.
- Veritabanı yalnızca uygulama sunucusundan erişilebilir mi (IP kısıtı / özel ağ)?
- `rateLimit` (`src/lib/api.ts`) bellek içidir; birden fazla sunucuda PostgreSQL/Redis tabanlı sınırlayıcıya geçin.
- Uçtan uca test (`npm run test:e2e`) örnek verileri değiştirir; **canlı veritabanında çalıştırmayın.**
