# AGENTS.md — Fen Bahçeleri Okul Giriş-Çıkış Sistemi (monorepo)

Bu dosya, bu depoda çalışan yapay zekâ kodlama ajanları (Claude Code, Codex, Cursor vb.) ve geliştiriciler içindir.
Projenin **ne yaptığını, iki uygulamanın birbiriyle nasıl konuştuğunu ve değişmemesi gereken kuralları** anlatır.
Alt projelerin kendi ayrıntıları: [`AdminPanel/AGENTS.md`](AdminPanel/AGENTS.md), [`QrScannerApp/AGENTS.md`](QrScannerApp/AGENTS.md).

> Arayüz tasarımı serbesttir. **Bu dosyadaki protokol, API sözleşmesi, veri modeli ve iş kuralları birebir uygulanmalıdır** —
> mobil uygulama ile sunucu ancak böyle birbirini anlar.

---

## 1. Ürün

Öğrencinin okula giriş ve çıkışını kayıt altına alan sistem:

1. Okul kapısında bir **kiosk** (Android tablet) durur; ekranında **5 saniyede bir değişen imzalı bir QR kod** gösterir ve aynı anda **Bluetooth (BLE) ile kısa ömürlü bir jeton** yayınlar.
2. Öğrenci kendi telefonundaki uygulamayla QR'ı okutur. Telefon, kioskun BLE jetonunu da duyduğunu kanıtlar (QR'ın fotoğrafını eve götürüp okutmayı engeller).
3. Sunucu okutmayı doğrular, **giriş veya çıkış** kaydı açar ve veliye SMS kaydı oluşturur.
4. Okul yönetimi **web panelinden** öğrencileri, cihazları, kayıtları ve reddedilen (şüpheli) okutmaları izler.

**Tek kiosk, yönsüz QR:** Kioskun giriş/çıkış ayrımı yoktur. Öğrencinin **ilk** okutmasında uygulama "Giriş mi, çıkış mı?" diye sorar; sonraki her okutmada yönü **sunucu** belirler (okuldaysa çıkış, dışarıdaysa giriş).

## 2. Mimari

```
 Android tablet (KIOSK)            Öğrenci telefonu (iOS/Android)          Tarayıcı (yönetici)
 QrScannerApp — kiosk modu         QrScannerApp — öğrenci modu             AdminPanel — web paneli
  • dönen QR (FB2)                  • QR okut + BLE jetonunu dinle
  • BLE yayını (service data)       • isteği cihaz anahtarıyla imzala
          │                                   │                                     │
          └──────────── HTTPS, JSON ──────────┴──────────── HTTPS (çerez oturumu) ──┘
                                              ▼
                          AdminPanel (Next.js) — web paneli + /api/mobile/*
                                              ▼
                                   PostgreSQL (yalnızca sunucu erişir)
```

- **Mobil uygulama veritabanına asla doğrudan bağlanmaz.** Tek bildiği şey sunucu adresidir (`EXPO_PUBLIC_API_URL`).
- Panel ve mobil API **aynı Next.js projesindedir** (`AdminPanel`).
- Tek mobil uygulama iki modda çalışır: **Öğrenci girişi** ve **Yönetici girişi (kiosk)**.

## 3. Depo yapısı

```
/AGENTS.md, /CLAUDE.md          bu dosyalar (ortak sözleşme)
/AdminPanel                     Next.js 16 + PostgreSQL: web paneli ve mobil API
  db/schema.sql                 veritabanı şeması (tek doğru kaynak)
  src/lib/protocol.ts           QR / BLE / imza protokolü  ◀── mobildeki ile BİREBİR aynı
  src/lib/scan.ts               okutma doğrulama iş kuralları
  src/lib/db/repo.ts            tüm veritabanı erişimi
  src/app/api/mobile/**         mobil API uç noktaları
  src/app/(panel)/**            web paneli sayfaları
  deploy/                       canlı sunucu (Docker: PostgreSQL + panel + Caddy HTTPS)
/QrScannerApp                   Expo (React Native): öğrenci + kiosk uygulaması
  src/lib/protocol.ts           ◀── sunucudaki ile BİREBİR aynı
  src/lib/ble.ts                BLE tarama
  modules/kiosk-beacon/         Android BLE yayını için yerel (Kotlin) modül
```

## 4. Protokol (değiştirmeyin; değiştirirseniz iki tarafı aynı commit'te güncelleyin)

| Sabit | Değer |
| --- | --- |
| `PROTOCOL_VERSION` | `"FB2"` |
| `SLOT_SECONDS` | `5` — QR ve BLE jetonu her 5 sn'de değişir |
| Dilim | `slot = floor(unixMilisaniye / 1000 / 5)` (sunucu saatine göre; kiosk sunucu saatiyle farkını düzeltir) |
| Sunucu toleransı | geçmiş **2** dilim, gelecek **1** dilim |
| `BLE_SERVICE_UUID` | `6f1b0000-5a1e-4c1a-9b9e-fb0000000001` |
| HMAC | HMAC-SHA256; anahtarlar **hex** metin olarak saklanır, kullanılırken bayta çevrilir |

**QR içeriği**
```
FB2.<kioskId>.<slot>.<imza>
imza = base64url( HMAC(kioskSecret, "FB2|<kioskId>|<slot>") ilk 16 bayt )   // dolgu (=) yok
```
**BLE jetonu** (8 bayt → 16 hex karakter)
```
bleToken = hex( HMAC(kioskSecret, "BLE|<kioskId>|<slot>") ilk 8 bayt )
```
- Android kiosk jetonu `BLE_SERVICE_UUID` altında **service data** olarak yayınlar.
- Apple cihazlar service data yayınlayamaz; test amaçlı iOS/macOS yayıncılar jetonu **yerel ad** olarak yayınlar: `"FB" + 16 hex`. Tarayıcı ikisini de kabul eder.
- Sunucu jetonu QR dilimi ve **±1 komşu dilim** için kabul eder.

**İstek imzası** (öğrencinin okutma isteği)
```
signature = hex( HMAC(deviceSecret, "<qr>|<bleToken veya boş>|<timestamp>") )   // 64 hex
```
`deviceSecret`: telefonun ilk girişte ürettiği 32 baytlık rastgele anahtar (64 hex), güvenli depoda (Keychain/Keystore) saklanır ve şifre oluşturulurken sunucuya bir kez gönderilir.

## 5. Mobil API sözleşmesi

Taban: `${EXPO_PUBLIC_API_URL}/api/mobile`. Gövdeler JSON. Kimlik: `Authorization: Bearer <JWT>`.
**Hata biçimi her yerde aynıdır:** HTTP durum kodu + `{ "error": "Türkçe, kullanıcıya gösterilebilir mesaj", "code": "MAKINE_KODU" }`.
Doğrulama hatası: `400 { error, code: "VALIDATION", issues }`. Sık deneme: `429 RATE_LIMIT`.

| Uç nokta | Kimlik | İstek | Başarılı yanıt |
| --- | --- | --- | --- |
| `GET /config` | — | — | `{ bleRequired, bleServiceUuid, slotSeconds, duplicateWindowSeconds, serverTime }` |
| `POST /student/check-email` | — | `{ email, deviceId }` | `{ next: "create-password" \| "password", firstName }` · Hatalar: `404 NOT_FOUND`, `409 DEVICE_TAKEN` (bu telefon başka öğrenciye bağlı), `403 WRONG_DEVICE` (hesap başka telefona bağlı) |
| `POST /student/set-password` | — | `{ email, password (≥8), deviceId, deviceSecret (64 hex), platform: "ios"\|"android"\|"web"\|"unknown" }` | `{ token, student: { id, firstName, lastName, className } }` · Hatalar: `409 ALREADY_HAS_PASSWORD`, `409 DEVICE_TAKEN`, `403 WRONG_DEVICE`, `404 NOT_FOUND` |
| `POST /student/login` | — | `{ email, password, deviceId }` | `{ token, student }` · `401 BAD_CREDENTIALS`, `403 WRONG_DEVICE` |
| `GET /student/me` | öğrenci | — | `{ student: {…, presenceStatus: "IN"\|"OUT"}, needsDirection: boolean, nextDirection: "IN"\|"OUT"\|null, events: [{ id, direction, occurredAt, kioskName }] }` (son 10) · `401 DEVICE_REVOKED` |
| `POST /scan` | öğrenci | `{ qr, ble: { token, rssi } \| null, timestamp, signature, direction?: "IN"\|"OUT"\|null }` | `{ eventId, direction, occurredAt, time: "HH:mm", duplicate, studentName, bleVerified: boolean\|null }` · Red: `422 { code: <RejectReason> }` |
| `POST /admin/login` | — | `{ email, password }` | `{ token, admin: { id, fullName } }` — ADMIN veya KIOSK rolü |
| `GET /kiosks` | kiosk-admin | — | `{ kiosks: [{ id, name }] }` (yalnızca aktifler) |
| `POST /kiosks/:id/start` | kiosk-admin | — | `{ kiosk: { id, name }, secret, slotSeconds, bleServiceUuid, bleRequired, serverTime }` |
| `GET /kiosks/:id/feed?since=ISO` | kiosk-admin | — | `{ serverTime, events: [{ id, name, className, direction, occurredAt, time }], attempts: [{ id, time, studentName, result, rejectReason, bleToken, bleRssi, bleOk }] }` |

**JWT** (HS256, `AUTH_SECRET`): öğrenci `{ sub: studentId, role: "student", deviceId }` 30 gün · kiosk `{ sub: adminId, role: "kiosk-admin" }` 180 gün · web paneli `{ sub, role: "web-admin" }` 12 saat, `fb_admin` httpOnly çerezinde.

**RejectReason** (`scan_attempts.reject_reason`): `INVALID_QR, EXPIRED_QR, UNKNOWN_KIOSK, BAD_SIGNATURE, DEVICE_NOT_BOUND, BLE_MISSING, BLE_MISMATCH, REPLAY` (+ yalnızca yanıt kodu olarak `DIRECTION_REQUIRED`; eski kayıtlarda `WRONG_STATE` bulunabilir).

## 6. İş kuralları (sunucu uygular; istemciye güvenilmez)

**Hesap ve cihaz**
- Kayıt ol yoktur. Yalnızca panelde tanımlı, aktif öğrenci e-postaları giriş yapabilir.
- İlk giriş: e-posta → şifre oluştur (en az 8 karakter). Bu anda telefon (`deviceId` + `deviceSecret`) hesaba **bağlanır**.
- **Bir öğrenci = bir aktif cihaz; bir cihaz = bir öğrenci.** Veritabanında kısmi tekil indeksle de korunur.
- Telefon-hesap bağlantısının **tek kaynağı sunucudur**; istemci yerel olarak "bu telefon başka hesaba bağlı" kararı vermez.
- Şifre sıfırlama yalnızca panelden: **Şifreyi sıfırla** (cihaz bağlı kalır) / **Cihazı sıfırla** (cihaz iptal + şifre silinir; yeni telefonda baştan).
- Şifreler bcrypt (maliyet 10) ile saklanır; düz metin şifre hiçbir yerde tutulmaz/loglanmaz.

**Okutma doğrulama sırası** (`AdminPanel/src/lib/scan.ts`) — her adım başarısızsa `scan_attempts`'a `REJECTED` yazılır:
1. Cihaz bu öğrenciye aktif bağlı mı? → `DEVICE_NOT_BOUND`. İstek imzası doğru mu? → `BAD_SIGNATURE`
2. QR biçimi + kiosk var ve aktif mi + kiosk imzası doğru mu? → `INVALID_QR` / `UNKNOWN_KIOSK`
3. Dilim tazeliği (−2…+1) → `EXPIRED_QR`
4. BLE: jeton geldiyse eşleşme kontrolü (`ble_ok`); `BLE_REQUIRED=true` ise jeton yok → `BLE_MISSING`, eşleşmiyor → `BLE_MISMATCH`
5. Aynı cihaz + kiosk + dilim daha önce **kabul** edildiyse → `REPLAY` (veritabanında kısmi tekil indeksle de korunur)
6. **Yön**:
   - Son kayıttan bu yana `DUPLICATE_WINDOW_SECONDS` (varsayılan 120) geçmediyse → **çift okutma**: yeni kayıt/SMS yok, `duplicate: true` ile son kayıt döner.
   - Öğrencinin hiç kaydı yoksa yön istekteki `direction`'dır; yoksa `422 DIRECTION_REQUIRED` (bu durum **kaydedilmez**).
   - Kaydı varsa yön = `presenceStatus`'un tersi (IN → OUT, OUT → IN). İstekteki `direction` **yok sayılır**.
7. Kabul: tek transaction'da `attendance_events` + `students.presence_status` + her veliye `sms_messages` (bir olay için bir veliye tek SMS).

**SMS**: 1. aşamada gerçek gönderim yok (`SMS_PROVIDER=mock`): mesaj kaydedilir, durumu `MOCK_SENT` olur. Metin: `Sayin Veli, <Ad Soyad> <HH:mm>'de okula giris yapti. - <Okul>`.

**Panelden manuel giriş/çıkış**: telefonu olmayan öğrenci için; `source = MANUAL`, aynı SMS kuralları.

**Saat dilimi**: gösterimler ve "bugün" hesabı `Europe/Istanbul`.

## 7. Güvenlik kuralları (açık kaynak proje)

- **Hiçbir gizli bilgi depoya girmez**: `.env`, `.env.local`, `deploy/.env`, anahtarlar, gerçek şifreler. Şablonlar `*.env.example` olarak, boş değerlerle tutulur.
- Kod, betik veya belgelere gerçek/örnek şifre yazmayın; komut satırı argümanı olarak şifre vermeyin (kabuk geçmişine girer). Gizli değerler ortam değişkeninden veya gizli girişle alınır.
- Geliştirme tohum verisi (`seed.ts`) yalnızca yerel test içindir; üretimde (`NODE_ENV=production`) çalışmaz.
- Kiosk gizli anahtarı (`kiosks.secret`) ve cihaz anahtarı (`devices.device_secret`) API yanıtlarında yalnızca belgelenen yerlerde döner; loglara yazılmaz.
- Veritabanı portu internete açılmaz. Canlıda yalnızca HTTPS.
- Kullanıcıya dönen hata mesajları Türkçe ve kısa; iç hata ayrıntısı (stack, SQL) istemciye dönmez.

## 8. Ortak çalışma kuralları

- **Dil**: arayüz metinleri, hata mesajları, kod yorumları ve belgeler **Türkçe**; tanımlayıcılar (değişken, fonksiyon, tablo, kolon) **İngilizce**.
- Veritabanında `snake_case`, kodda `camelCase`. Kimlikler metin ve önekli: `stu_…`, `gua_…`, `adm_…`, `kiosk_…`, `evt_…`, `att_…`, `sms_…`, `aud_…` (önek + 16 hex).
- Zamanlar veritabanında `timestamptz`, API'de ISO 8601 metin.
- Protokol veya API sözleşmesini değiştiren her iş, **sunucu + mobil + bu dosya + uçtan uca test** birlikte güncellenmeden bitmiş sayılmaz.
- Her yönetici işlemi `audit_logs`'a yazılır.
- Commit mesajları Türkçe, ilk satır ≤ 72 karakter, "ne ve neden".

## 9. Bitti tanımı (her iş için)

1. `AdminPanel`: `npx tsc --noEmit` ve `npx eslint src scripts` temiz.
2. `QrScannerApp`: `npm run typecheck` ve `npx eslint src` temiz.
3. Sunucu davranışı değiştiyse `npm run test:e2e` (AdminPanel) tamamen geçer; yeni kural için test eklenmiştir.
4. Gizli bilgi yok (`git diff` kontrol edildi), ilgili belge güncellendi.

## 10. Hızlı başlangıç

```bash
# Sunucu (Docker Desktop açık olmalı)
cd AdminPanel && npm install && cp .env.example .env.local   # AUTH_SECRET, POSTGRES_PASSWORD, DATABASE_URL doldurun
npm run db:up && npm run db:setup && npm run dev               # http://localhost:3000

# Mobil (ayrı terminal)
cd QrScannerApp && npm install
echo "EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):3000" > .env
npx expo run:ios --device    # veya: npx expo run:android --device (BLE için geliştirme derlemesi gerekir)
```
Ayrıntılar: `AdminPanel/POSTGRESQL_KURULUM.md`, `QrScannerApp/CIHAZ_TESTI.md`, `CANLIYA_ALMA.md`.
