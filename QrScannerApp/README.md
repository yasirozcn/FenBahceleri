# QrScannerApp — Fen Bahçeleri Giriş

Tek uygulama, iki mod:

- **Öğrenci girişi:** e-posta → (ilk seferde) şifre oluştur, telefon hesaba bağlanır . Sonra "QR okut". Şifre sıfırlama yalnızca panelden.
- **Yönetici girişi:** yalnızca kiosk ekranını açar; seçilen kapı için 5 sn'de bir yenilenen QR gösterir ve (Android'de) BLE jetonu yayınlar.

Kayıt ol yoktur; öğrenci e-postaları AdminPanel veritabanındadır. Bir telefonda yalnızca bir öğrenci hesabı çalışır; öğrenci başka telefona geçecekse yönetici panelden **Cihazı sıfırla** yapar.

## Yapı

```
src/app/                 Ekranlar (Expo Router)
  index.tsx              Öğrenci / Yönetici seçimi
  student-login.tsx      E-posta → kod → şifre / e-posta → şifre
  student-home.tsx       Durum, son hareketler
  scan.tsx               QR okutma + BLE
  admin-login.tsx        Yönetici girişi
  kiosk-select.tsx       Kapı seçimi
  kiosk/[id].tsx         Dönen QR + BLE yayını + son okutanlar
src/lib/
  protocol.ts            QR / BLE / imza (AdminPanel ile birebir aynı)
  device.ts              Cihaz kimliği ve anahtarı (Keychain / Keystore)
  ble.ts                 Kiosk BLE taraması, Bluetooth durumu, [BLE] logları
  ble-debug.tsx          Bluetooth testi ekranı (src/app/)
  api.ts, session.tsx    Sunucu çağrıları ve oturum
modules/kiosk-beacon/    Android BLE yayını için yerel Kotlin modülü
```

## Çalıştırma

```bash
npm install
cp .env.example .env     # EXPO_PUBLIC_API_URL'yi Mac'inizin yerel IP'siyle düzenleyin
```

**Hızlı arayüz denemesi (BLE yok):** App Store'dan Expo Go'yu kurun, `npx expo start` → terminalde `s` ile Expo Go moduna geçin → QR'ı iPhone kamerasıyla okutun. Kamera, QR okuma ve giriş çalışır; BLE devre dışı kalır (sunucuda `BLE_REQUIRED=false` iken okutmalar yine kabul edilir).

**Tam deneme (BLE dahil) — geliştirme derlemesi:**

```bash
# iPhone (Mac'te Xcode kuruluysa, telefon kabloyla bağlı)
npx expo run:ios --device

# Android tablet/telefon (Android Studio kuruluysa, USB hata ayıklama açık)
npx expo run:android --device

# Xcode/Android Studio olmadan: EAS bulut derlemesi
npx eas-cli@latest build --profile development --platform ios
```

**Cihazla test:** [CIHAZ_TESTI.md](./CIHAZ_TESTI.md) — Android kiosk (APK) + iPhone öğrenci; ya da yalnızca iPhone + Mac (`tools/mac-kiosk-beacon.swift`). Uygulamadaki **Bluetooth testi** ekranı tarama ayrıntılarını gösterir, tüm olaylar `[BLE]` önekiyle Metro terminaline yazılır.

TestFlight ile dağıtım: [TESTFLIGHT.md](./TESTFLIGHT.md)

## Kontroller

```bash
npm run typecheck
npm run lint
```

## Bilinen 1. aşama sınırları

- Kiosk BLE yayını yalnızca Android'de (iOS uygulamaları servis verisi yayınlayamaz). iPad kiosk olarak kullanılırsa QR çalışır, BLE yayını olmaz.
- Yerel Kotlin/Swift modülü bu ortamda derlenmedi; JS paketleme, tip kontrolü ve `expo prebuild` doğrulandı. İlk `expo run:android` sonucunu kontrol edin.
- Cihaz anahtarı yazılımla üretiliyor; donanım anahtarı ve Play Integrity / App Attest 2. aşamada.
