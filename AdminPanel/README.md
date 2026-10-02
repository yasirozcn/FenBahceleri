# AdminPanel — Fen Bahçeleri Giriş-Çıkış

Yönetici web paneli **ve** mobil uygulamanın kullandığı API aynı Next.js projesindedir. Veriler PostgreSQL'dedir; yerel kurulum ve canlıya alma: [POSTGRESQL_KURULUM.md](./POSTGRESQL_KURULUM.md).

## Çalıştırma

```bash
npm install
cp .env.example .env.local     # AUTH_SECRET, POSTGRES_PASSWORD, DATABASE_URL'yi doldurun
npm run db:up                  # PostgreSQL (Docker Desktop açık olmalı)
npm run db:setup               # tablolar
npm run dev                    # http://localhost:3000
```

İlk istekte boş veritabanına örnek veriler eklenir. Sıfırlamak için: `npm run db:reset` ve `npm run dev`'i yeniden başlatın.

Telefonun sunucuya ulaşabilmesi için telefon ve Mac aynı Wi-Fi'da olmalı; mobil uygulamada `EXPO_PUBLIC_API_URL=http://<Mac'in IP'si>:3000` kullanın (`next dev` terminalde "Network:" satırında bu adresi yazar).

## Test hesapları (yalnızca örnek veriler)

Tüm test e-postaları, şifreleri ve kayıt kodları [`src/lib/db/seed.ts`](./src/lib/db/seed.ts) dosyasındadır:

- `SEED_ADMINS` — web paneline giren **ADMIN** hesabı ve yalnızca uygulamada QR ekranını açabilen **KIOSK** hesabı
- `SEED_STUDENTS` — 5 örnek öğrenci (şifresiz; uygulamada ilk girişte şifre oluşturulur)

Aynı öğrenciyle baştan denemek için panelden **Cihazı sıfırla** (yeni telefon) veya **Şifreyi sıfırla** (aynı telefon) yapın ya da `npm run db:reset`.

## Panel sayfaları

| Sayfa | İçerik |
| --- | --- |
| Canlı durum | Okulda/dışarıda sayıları, bugünkü hareketler ve reddedilen okutmalar |
| Giriş-çıkışlar | Tüm kayıtlar, "Uygun / Şüpheli" işaretleme |
| Öğrenciler | Öğrenci ekleme, tek seferlik kod üretme, cihaz sıfırlama, manuel giriş/çıkış |
| Kiosklar | Giriş/çıkış kioskları, çevrimiçi durumu, devre dışı bırakma |
| Reddedilen okutmalar | Süresi geçmiş QR, yanlış cihaz, tekrar oynatma vb. hile denemeleri |
| SMS kayıtları | Veliye giden mesajlar (test modunda gönderilmez) |
| Denetim kaydı | Yönetici işlemleri |

## Mobil API

| Uç nokta | Açıklama |
| --- | --- |
| `GET /api/mobile/config` | BLE zorunlu mu, dilim süresi, sunucu saati |
| `POST /api/mobile/student/check-email` | E-posta kayıtlı mı; `create-password` (ilk giriş) mi yoksa `password` mı |
| `POST /api/mobile/student/set-password` | İlk girişte şifreyi kaydeder ve telefonu hesaba bağlar |
| `POST /api/mobile/student/login` | Şifre ile giriş (yalnızca bağlı cihazdan) |
| `GET /api/mobile/student/me` | Durum ve son hareketler |
| `POST /api/mobile/scan` | QR okutma (imzalı istek) |
| `POST /api/mobile/admin/login` | Uygulama içi yönetici girişi (kiosk) |
| `GET /api/mobile/kiosks` · `POST /api/mobile/kiosks/:id/start` · `GET /api/mobile/kiosks/:id/feed` | Kiosk ekranı |

Okutma doğrulama kuralları `src/lib/scan.ts`, QR/BLE/imza protokolü `src/lib/protocol.ts` içindedir. Protokol mobil uygulamadaki `src/lib/protocol.ts` ile birebir aynı olmalıdır.

## Test

```bash
npm run build && npm start          # ayrı terminalde
npm run test:e2e                    # 20 uçtan uca kontrol
```

## Bilinen 1. aşama sınırları

- Cihaz anahtarı yazılımla üretiliyor; donanım anahtarı + Play Integrity / App Attest 2. aşamada.
- SMS gerçekten gönderilmiyor (`SMS_PROVIDER=mock`).
- Kiosk gizli anahtarı tablete düz metin olarak iletiliyor.
- Canlı ekranlar 3-10 sn'de bir yenileniyor (WebSocket yerine).
- Giriş denemesi sınırlayıcı bellek içi; tek sunucu için yeterli.
