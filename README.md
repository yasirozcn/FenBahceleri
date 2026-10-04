# Fen Bahçeleri — Okul Giriş-Çıkış Sistemi (1. aşama)

| Klasör | İçerik |
| --- | --- |
| [`AdminPanel/`](./AdminPanel) | Next.js: yönetici web paneli + mobil uygulamanın API'si (PostgreSQL) |
| [`QrScannerApp/`](./QrScannerApp) | React Native (Expo): öğrenci girişi + yönetici/kiosk modu tek uygulamada |

## 5 dakikada yerel deneme

```bash
# 1) Sunucu
cd AdminPanel && npm install
cp .env.example .env.local   # doldurun: AdminPanel/POSTGRESQL_KURULUM.md
npm run db:up && npm run db:setup && npm run dev
# Tarayıcı: http://localhost:3000  (test hesapları: AdminPanel/src/lib/db/seed.ts)

# 2) Mobil uygulama (ayrı terminal)
cd QrScannerApp && npm install
echo "EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):3000" > .env
npx expo start
```

Kiosk ekranını bir cihazda (yönetici girişi), öğrenci hesabını başka bir cihazda açıp QR'ı okutun.

## Sonraki adımlar

1. [Canlıya alma: AWS Lightsail, ~7 $/ay](./CANLIYA_ALMA.md) · [PostgreSQL yerel kurulum](./AdminPanel/POSTGRESQL_KURULUM.md)
2. [TestFlight ile ilk testler](./QrScannerApp/TESTFLIGHT.md)
3. BLE prototip ölçümleri → `BLE_REQUIRED=true`
4. 2. aşama: donanım anahtarı + Play Integrity / App Attest, gerçek SMS sağlayıcısı, kalıcı barındırma
