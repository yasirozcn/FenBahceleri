<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — AdminPanel (web paneli + mobil API)

Önce kökteki [`../AGENTS.md`](../AGENTS.md) dosyasını okuyun: protokol, API sözleşmesi ve iş kuralları oradadır ve **bağlayıcıdır**.
Bu dosya AdminPanel'in nasıl kurulduğunu ve hangi kurallarla geliştirildiğini anlatır.

## 1. Teknoloji

| Katman | Seçim |
| --- | --- |
| Çatı | **Next.js 16** (App Router, Turbopack, Server Components, Server Actions), React 19, TypeScript (strict) |
| Stil | Tailwind CSS 4 (`src/app/globals.css` içinde `.btn`, `.card`, `.table`, `.badge`, `.input` yardımcı sınıfları) |
| Veritabanı | PostgreSQL 17 (yerelde Docker), sürücü `pg` (ORM yok, el yazımı SQL) |
| Doğrulama | `zod` (her API gövdesi) |
| Kimlik | `jose` (JWT HS256), `bcryptjs` (şifre özeti, maliyet 10) |
| Canlı | Docker (`output: "standalone"`) + Caddy (otomatik HTTPS) — `deploy/` |

Paket yöneticisi **pnpm** (`pnpm-lock.yaml`). `npm run <script>` komutları da çalışır.

## 2. Klasör yapısı

```
db/schema.sql                    Tek şema dosyası. Tekrar çalıştırılabilir (IF NOT EXISTS / DROP ... IF EXISTS).
scripts/
  db-setup.mjs                   Şemayı DATABASE_URL'ye uygular (--reset: tüm tabloları siler, yalnızca yerel)
  create-admin.mjs               Yönetici/kiosk hesabı oluşturur veya şifresini günceller (şifre gizli sorulur)
  e2e-test.mjs                   Mobil API'yi uçtan uca test eder (çalışan sunucuya karşı)
  json-to-postgres.mjs           Eski JSON verisini aktarır (tarihsel; yeni projede gerekmez)
src/lib/
  config.ts                      Ortam değişkenlerinden okunan ayarlar (tek yer)
  protocol.ts                    QR/BLE/istek imzası — mobildeki ile birebir aynı
  scan.ts                        Okutma doğrulama + yön mantığı + panelden manuel olay
  auth.ts                        JWT üret/doğrula, Bearer çözme
  session.ts                     Web paneli çerez oturumu (fb_admin), requireWebAdmin()
  api.ts                         handler(), body(), ApiError, requireStudent/requireKioskAdmin, rateLimit, clientIp
  sms.ts                         SMS metni, saat biçimleme (Europe/Istanbul), gönderim (mock)
  db/pg.ts                       Bağlantı havuzu (ilk sorguda açılır), q(), tx(), insertRow(), camel(); geliştirmede boş DB'ye tohum
  db/repo.ts                     TÜM veritabanı erişimi (aşağıdaki liste)
  db/types.ts                    Tablo tipleri (camelCase)
  db/seed.ts                     Geliştirme tohum verisi (2 yönetici, 5 öğrenci, 1 kiosk)
src/app/
  login/                         Panel girişi (Server Action)
  (panel)/                       Oturum gerektiren panel sayfaları (layout'ta requireWebAdmin)
  api/mobile/**/route.ts         Mobil API (kök AGENTS.md §5)
deploy/                          Canlı: docker-compose.yml, Caddyfile, .env.example, sunucu-hazirla.sh, yedek-al.sh
docker-compose.yml               Yerel geliştirme PostgreSQL'i
Dockerfile                       Canlı imaj (standalone + şema/yönetim betikleri)
```

## 3. Veri katmanı kuralları

- **Veritabanına yalnızca `src/lib/db/repo.ts` erişir.** Sayfalar, route'lar ve iş kuralları repo fonksiyonlarını çağırır; başka yerde SQL yazılmaz.
- Repo fonksiyonları: `findStudentByEmail, getStudent, listStudents, createStudent, setStudentPassword, getActiveDevice, getActiveDeviceForStudent, setFirstPasswordAndBindDevice, resetStudentPassword, resetStudentDevice, findAdminByEmail, getAdmin, listKiosks, getKiosk, touchKiosk, createKiosk, setKioskStatus, deleteKiosk, insertScanAttempt, isReplay, lastEventForStudent, createEventWithSms, updateSms, getEvent, reviewEvent, listEvents, listScanAttempts, listKioskAttempts, listSms, dashboardStats, addAudit, listAudit`.
- Her zaman **parametreli sorgu** (`$1, $2`); kullanıcı girdisini SQL metnine eklemeyin.
- Birden çok tabloya yazan işlemler `tx()` içinde (transaction): `createStudent`, `setFirstPasswordAndBindDevice` (öğrenci satırı `FOR UPDATE` ile kilitlenir), `resetStudentDevice`, `createEventWithSms`.
- Satırlar `camel()` ile camelCase'e, `Date` değerleri ISO metne çevrilir. `bigint` (time_slot) sayı olarak döner.
- `insertScanAttempt`: kabul edilmiş aynı (cihaz, kiosk, dilim) ikinci kez yazılırsa tekil indeks hatası (`23505`) yakalanır ve kayıt `REJECTED/REPLAY` olarak yazılır.
- `dashboardStats`: "bugün" Türkiye saatine göre (`date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul')`).

### Tablolar (`db/schema.sql`)

| Tablo | Amaç / önemli kolonlar | Kısıtlar |
| --- | --- | --- |
| `students` | school_no, first_name, last_name, email, class_name, password_hash (null = henüz şifre yok), presence_status `IN/OUT` (varsayılan OUT), is_active | `lower(email)` tekil |
| `guardians` | full_name, phone | |
| `student_guardians` | student_id, guardian_id, relation, notify_entry, notify_exit | PK (student_id, guardian_id) |
| `devices` | id = uygulamanın ürettiği deviceId, student_id, platform, device_secret, status `ACTIVE/REVOKED`, bound_at, revoked_at, revoked_by | öğrenci başına tek ACTIVE (kısmi tekil indeks) |
| `kiosks` | name, secret (32 bayt hex), status `ACTIVE/DISABLED`, last_seen_at | **yön kolonu yok** |
| `scan_attempts` | device_id, student_id, kiosk_id, time_slot, ble_token, ble_rssi, ble_ok, integrity_ok, result `ACCEPTED/REJECTED`, reject_reason | (device_id, kiosk_id, time_slot) ACCEPTED için tekil |
| `attendance_events` | student_id, direction `IN/OUT`, occurred_at, source `APP/MANUAL/OFFLINE`, kiosk_id, scan_attempt_id, review_status `UNREVIEWED/OK/SUSPICIOUS`, reviewed_by, note | |
| `sms_messages` | event_id, guardian_id, phone, body, status `QUEUED/SENT/DELIVERED/FAILED/MOCK_SENT`, attempt_count, sent_at | (event_id, guardian_id) tekil |
| `permissions` | izin kayıtları (ileride) | |
| `admin_users` | full_name, email, role `ADMIN/KIOSK`, password_hash | `lower(email)` tekil |
| `audit_logs` | admin_user_id, action, entity, entity_id, before_value/after_value (jsonb) | |

Şema değişikliği: `db/schema.sql`'e `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP ... IF EXISTS` ile ekleyin, `types.ts` ve `repo.ts`'i güncelleyin. Canlı sunucu her açılışta şemayı uygular.

## 4. Web paneli

Oturum: `/login` (Server Action, bcrypt). Yalnızca `role = ADMIN` girer; KIOSK hesabı panele giremez. Oturum 12 saat, `fb_admin` httpOnly çerezi (`COOKIE_SECURE`).
Her yönetici işlemi Server Action (`src/app/(panel)/actions.ts`) ile yapılır ve `addAudit` ile kaydedilir; sonra `revalidatePath`.

| Sayfa | İçerik |
| --- | --- |
| `/` Canlı durum | Kartlar: okulda / dışarıda / bugünkü hareket (+incelenmemiş) / bugün reddedilen okutma; son 15 hareket; 10 sn'de bir otomatik yenilenir |
| `/hareketler` | Tüm giriş-çıkışlar; filtre: tümü / incelenmedi / dikkat gerekenler (manuel + şüpheli) / şüpheli; "Uygun" / "Şüpheli" işaretleme |
| `/ogrenciler` | Liste (sınıf + soyada göre, Türkçe sıralama), veli, durum, bağlı cihaz; **Şifreyi sıfırla**, **Cihazı sıfırla**, **Manuel giriş/çıkış**; yeni öğrenci formu (okul no, ad, soyad, sınıf, e-posta, veli adı, veli telefonu) |
| `/kiosklar` | Kiosk listesi (çevrimiçi = son 60 sn'de sinyal), ekle (yalnızca ad), devre dışı bırak / etkinleştir, sil (geçmiş kayıtlar korunur) |
| `/denemeler` | Reddedilen okutmalar (neden, öğrenci, kiosk, BLE bilgisi) |
| `/sms` | Veli SMS kayıtları ve durumları |
| `/denetim` | Denetim kaydı (yönetici işlemleri) |

Server Components veriyi doğrudan repo'dan okur (`export const dynamic = "force-dynamic"`). İstemci bileşenleri yalnızca form durumu ve otomatik yenileme içindir.

## 5. Mobil API uygulama kuralları

- Her route `handler(async (req) => …)` ile sarılır; gövde `await body(req, zodSchema)` ile doğrulanır; hata `throw new ApiError(status, "Türkçe mesaj", "KOD")`.
- Kimlik: `requireStudent(req)` / `requireKioskAdmin(req)`. Öğrenci isteklerinde cihazın hâlâ aktif ve o öğrenciye bağlı olduğu da kontrol edilir (`DEVICE_REVOKED`).
- Giriş uç noktalarında `rateLimit` (bellek içi): check-email 30/IP; set-password 8/e-posta + 30/IP; login 10/e-posta + 50/IP; admin login 10/e-posta + 30/IP (10 dk pencere).
- Okutma iş kuralları yalnızca `src/lib/scan.ts`'te; route ince kalır. Her okutma denemesi sunucu loguna tek satır yazılır: `[scan] KABUL (IN) · öğrenci … · kiosk … · BLE … → EŞLEŞTİ`.
- SMS gönderimi yanıtı bekletmez (`void dispatchSms(sms)`).

## 6. Ortam değişkenleri (`.env.example`)

| Değişken | Açıklama |
| --- | --- |
| `AUTH_SECRET` | JWT anahtarı, `openssl rand -hex 32`. Üretimde zorunlu, ortam başına farklı |
| `DATABASE_URL` | `postgres://fb_app:<şifre>@localhost:5432/fenbahceleri` |
| `POSTGRES_PASSWORD` | Yalnızca yerel Docker veritabanını oluşturmak için |
| `DATABASE_SSL` | Yönetilen PostgreSQL'de `true` |
| `SEED_SAMPLE_DATA` | Boş DB'ye örnek veri; varsayılan geliştirmede açık, üretimde kapalı |
| `BLE_REQUIRED` | `true`: BLE jetonu zorunlu |
| `DUPLICATE_WINDOW_SECONDS` | Çift okutma penceresi (varsayılan 120) |
| `SMS_PROVIDER` | `mock` |
| `SCHOOL_SHORT_NAME` | SMS imzası |
| `COOKIE_SECURE` | HTTP üzerinden yerel denemede `false` |

## 7. Komutlar

```bash
npm run db:up        # yerel PostgreSQL (Docker)
npm run db:setup     # şemayı uygula
npm run dev          # http://localhost:3000 (boş DB'ye tohum: admin@fenbahceleri.test / kapi@fenbahceleri.test, şifreler seed.ts'te)
npx tsc --noEmit     # tip kontrolü
npx eslint src scripts
npm run test:e2e     # çalışan sunucuya karşı uçtan uca test (API_URL=… ile başka adres)
```
**Uçtan uca test tohum verisini değiştirir**: ayrı bir veritabanında çalıştırın (`DATABASE_URL=…/fenbahceleri_test SEED_SAMPLE_DATA=true`). Otomatik giriş/çıkış sırası testi için sunucuyu `DUPLICATE_WINDOW_SECONDS=2` ile başlatın; çift okutma testi varsayılan (120) ile çalışır.

## 8. Canlı ortam

`deploy/` + kök `CANLIYA_ALMA.md`: tek sunucuda Docker Compose (`db` + `app` + `caddy`). Uygulama konteyneri açılışta `db-setup.mjs` çalıştırır. İlk hesaplar `docker compose exec app node scripts/create-admin.mjs --email … --role ADMIN|KIOSK`. Yedek: `deploy/yedek-al.sh` (cron).

## 9. Yapılmaması gerekenler

- `repo.ts` dışında SQL; ORM eklemek; şemayı elle (psql'de) değiştirip `schema.sql`'e yazmamak.
- İstemciden gelen `direction`'a, öğrenci kimliğine veya zaman damgasına güvenmek (öğrenci kimliği JWT'den, yön sunucudan, tazelik sunucu saatinden).
- Hata yanıtında stack/SQL ayrıntısı döndürmek; şifre, anahtar veya JWT loglamak.
- `protocol.ts`'i mobil tarafı güncellemeden değiştirmek.
