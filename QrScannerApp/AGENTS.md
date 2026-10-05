This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

---

# AGENTS.md — QrScannerApp (öğrenci + kiosk uygulaması)

Önce kökteki [`../AGENTS.md`](../AGENTS.md) dosyasını okuyun: protokol, API sözleşmesi ve iş kuralları oradadır ve **bağlayıcıdır**.
Arayüz tasarımı serbesttir; ekranların **akışı, sunucuyla konuşma biçimi ve güvenlik kuralları** aşağıdaki gibi olmalıdır.

## 1. Teknoloji

| Konu | Seçim |
| --- | --- |
| Çatı | Expo SDK 57, React Native 0.86, React 19, TypeScript strict, Expo Router (dosya tabanlı) |
| Kamera / QR | `expo-camera` (`CameraView`, `barcodeScannerSettings: { barcodeTypes: ["qr"] }`) |
| QR gösterme | `react-native-qrcode-svg` (+ `react-native-svg`) |
| Kripto | `@noble/hashes` (HMAC-SHA256), `expo-crypto` (rastgele bayt, UUID) |
| Güvenli depo | `expo-secure-store` (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) |
| BLE tarama | `react-native-ble-plx` (yalnızca geliştirme/mağaza derlemesinde; **Expo Go'da yok**) |
| BLE yayını | yerel Expo modülü `modules/kiosk-beacon` (Android Kotlin; iOS "desteklenmiyor" döner) |
| Ekran açık kalsın | `expo-keep-awake` (kiosk) |
| Derleme ayarı | `app.config.ts` (`expo-build-properties`: adres `http://` ise Android düz HTTP izni) |

Sunucu adresi: `.env` → `EXPO_PUBLIC_API_URL` (derlemede uygulamaya gömülür). Canlıda `https://…`.

## 2. Klasör yapısı

```
src/app/                    Ekranlar (Expo Router)
  _layout.tsx               SessionProvider + Stack + BluetoothGate
  index.tsx                 Açılış: oturuma göre yönlendirir; yoksa "Öğrenci girişi / Yönetici girişi (kiosk) / Bluetooth testi"
  student-login.tsx         e-posta → (şifre oluştur | şifre)
  student-home.tsx          durum (okulda/dışarıda), "QR okut", son hareketler, çıkış yap
  scan.tsx                  (ilk okutmada yön seçimi) → kamera + BLE tarama → sonuç
  admin-login.tsx           kiosk hesabıyla giriş
  kiosk-select.tsx          kiosk seçimi
  kiosk/[id].tsx            dönen QR + BLE yayını + son okutanlar
  ble-debug.tsx             Bluetooth testi (durum, çevredeki cihazlar, jeton, log)
src/components/             ui.tsx (Screen, Title, Button, Field, ErrorBox, InfoBox, Card), BluetoothGate.tsx
src/lib/
  config.ts                 API_URL, renkler
  api.ts                    api<T>() istemcisi + yanıt tipleri (kök AGENTS.md §5 ile aynı)
  session.tsx               SessionProvider: studentToken, adminToken, config
  device.ts                 deviceId + deviceSecret üretimi/saklanması, token saklama
  protocol.ts               QR/BLE/istek imzası — sunucudaki ile BİREBİR aynı
  ble.ts                    BLE durum, tarama, jeton çözme, [BLE] log arabelleği
modules/kiosk-beacon/       Android BLE yayın modülü (startAdvertising/stopAdvertising/isSupported/getLastError)
tools/
  mac-kiosk-beacon.swift    Mac'i test kioskuna çevirir (terminalde QR + BLE yerel ad yayını)
  ios-kur.sh                iPhone'a Release derleyip kurar (TEAM_ID gerekir)
  android-apk.sh            Android kiosk APK'sı (Java 17 gerekir)
```

## 3. Akışlar

### Öğrenci
1. **E-posta** → `POST /student/check-email { email, deviceId }`.
   - `next: "create-password"` → şifre + tekrar (≥8) → `POST /student/set-password` (deviceSecret ve platform da gönderilir). Bu adımda telefon hesaba bağlanır; kullanıcıya bunu söyleyen bir bilgi kutusu gösterilir.
   - `next: "password"` → `POST /student/login`.
   - Hatalar sunucunun Türkçe mesajıyla gösterilir (`DEVICE_TAKEN`, `WRONG_DEVICE`, `NOT_FOUND`…). **Telefonda yerel "bağlı hesap" kontrolü yapılmaz.**
2. Başarılı girişte token güvenli depoya yazılır → **Ana ekran** (`GET /student/me`): "Okuldasınız / Okul dışındasınız", buton metni `needsDirection ? "QR okut" : (IN ? "Çıkış için QR okut" : "Giriş için QR okut")`, son 10 hareket, aşağı çekince yenile.
   `401 DEVICE_REVOKED` → oturumu sil, uyarı göster, açılışa dön. Diğer `401` → giriş ekranına.
3. **Okutma** (`scan.tsx`):
   - Açılışta `GET /student/me`; `needsDirection` ise kamera açılmadan önce **"Okula giriyorum / Okuldan çıkıyorum"** seçimi gösterilir. Seçim yalnızca bu okutmada `direction` olarak gönderilir.
   - Ekranda "Bu okutma: GİRİŞ/ÇIKIŞ" (`chosenDirection ?? nextDirection`).
   - Ekran açıkken BLE taraması çalışır; en son jeton ve zamanı tutulur. QR okununca jeton **8 sn'den yeniyse** gönderilir.
   - QR `isOurQr` değilse uyarı, gönderme. `bleRequired` ve taze jeton yoksa "Kiosk Bluetooth sinyali bekleniyor" uyarısı, gönderme.
   - `POST /scan { qr, ble, timestamp: Date.now(), signature, direction }`.
   - Yanıt `DIRECTION_REQUIRED` ise yön seçimine dön. Başarıda: "Giriş/Çıkış kaydedildi", saat, `duplicate` ise "zaten kaydedilmişti", `bleVerified` sonucu.
   - Aynı anda iki istek gitmemesi için `busy` kilidi.

### Kiosk (Android tablet)
1. **Yönetici girişi** (KIOSK hesabı) → `POST /admin/login` → token güvenli depoya.
2. **Kiosk seçimi** (`GET /kiosks`).
3. **Kiosk ekranı** (`POST /kiosks/:id/start` → `secret`, `serverTime`):
   - Saat farkı `offset = serverTime - Date.now()`; dilim `slotAt(Date.now() + offset, slotSeconds)`, 250 ms'de bir kontrol edilir.
   - Her dilimde yeni QR (`buildQrPayload(secret, kioskId, slot)`) ve yeni BLE jetonu (`KioskBeacon.start(serviceUuid, bleToken(...))`).
   - QR'ın altında kalan süre çubuğu; ekran kapanmaz (`useKeepAwake`); yatay/dikey yerleşim.
   - 3 sn'de bir `GET /kiosks/:id/feed?since=` → yeni okutan öğrencinin adı ve "Giriş/Çıkış" 4 sn gösterilir; sunucuya ulaşılamazsa "çevrimdışı" göstergesi (QR üretimi internetsiz de sürer).
   - Android 12+ için `BLUETOOTH_ADVERTISE` + `BLUETOOTH_CONNECT` izinleri istenir. Yayın durumu ekranda: açık / kapalı / hata.
   - `401` → yönetici oturumunu sil, girişe dön.

### Bluetooth
- `BluetoothGate` (kök layout): Bluetooth kapalıysa veya izin yoksa kullanıcıyı açmaya yönlendiren pencere (iOS: Ayarlar'ı açar ve Denetim Merkezi'ni tarif eder; Android: Bluetooth'u açma isteği). "Şimdilik geç" denebilir; uygulama öne gelince tekrar sorar. Expo Go'da (modül yok) görünmez.
- Tarama filtresiz yapılır (`startDeviceScan(null, { allowDuplicates: true })`) ve her pakette jeton aranır: önce `serviceData[BLE_SERVICE_UUID]` (base64 → hex, 16 karakter), sonra `localName` `^FB[0-9a-f]{16}$`.
- Tüm olaylar `bleLog()` ile `[BLE]` önekli konsola ve uygulama içi log arabelleğine (son 300 satır) yazılır; **Bluetooth testi** ekranı bunları, cihaz listesini (ad, RSSI, servisler, KIOSK işareti) ve son jetonu gösterir.

## 4. Cihaz kimliği ve güvenlik

- `deviceId` (UUID) ve `deviceSecret` (32 rastgele bayt, hex) ilk ihtiyaçta üretilir ve SecureStore'da saklanır; bir daha değişmez. (iOS'ta Keychain kayıtları uygulama silinse de kalır.)
- `deviceSecret` yalnızca `set-password` isteğinde sunucuya gider; sonra yalnızca imza üretmekte kullanılır.
- Tokenlar SecureStore'da: `fb.studentToken`, `fb.adminToken`. AsyncStorage'a gizli bilgi yazılmaz.
- Şifre, token veya anahtar loglanmaz (BLE jetonları kısa ömürlü ve gizli değildir, loglanabilir).
- Galeriden QR seçme yoktur; yalnızca canlı kamera.

## 5. API istemcisi kuralları (`src/lib/api.ts`)

- `api<T>(path, { method, body, token, timeoutMs = 15000 })`: JSON gönderir, `Authorization: Bearer`, zaman aşımı `AbortController` ile.
- Başarısız yanıt → `ApiError(status, data.error, data.code)`; ekranlar `e.message`'ı doğrudan gösterir.
- Ağ hatası → `ApiError(0, "Sunucuya ulaşılamadı…", "NETWORK")`, zaman aşımı → `"TIMEOUT"`; gerçek hata `console.warn("[api] …")` ile loglanır.
- Expo SDK 57'de global `fetch` = `expo/fetch`; React Native'in eski `FormData { uri }` biçimini desteklemez (dosya yükleme gerekirse `expo-file-system` `File` kullanın).

## 6. Komutlar ve test

```bash
npm install
npm run typecheck && npx eslint src         # her işten sonra
npx expo start --go                          # Expo Go ile hızlı arayüz denemesi (BLE YOK)
npx expo run:ios --device                    # geliştirme derlemesi (BLE var, Metro logları terminalde)
npx expo run:android --device                # Android (Java 17 + Android SDK + NDK 27.1 gerekir)
TEAM_ID=XXXXXXXXXX bash tools/ios-kur.sh     # bağımsız Release derlemesi → iPhone
bash tools/android-apk.sh                    # kiosk APK'sı (arm64-v8a)
swift tools/mac-kiosk-beacon.swift --email KIOSK_EPOSTA   # Mac'i test kioskuna çevirir (şifre gizli sorulur)
```
Tek iPhone ile test: `CIHAZ_TESTI.md`. `ios/` ve `android/` klasörleri üretilir (git'e girmez); elle düzenlemeyin.

## 7. Yapılmaması gerekenler

- Sunucu kararlarını istemcide tekrar vermek (yön, cihaz bağlılığı, QR geçerliliği) — istemci yalnızca gösterir ve gönderir.
- `protocol.ts`'i sunucuyu güncellemeden değiştirmek.
- BLE kütüphanesini koşulsuz içe aktarmak: `require` ile, hata yakalanarak yüklenir ki Expo Go'da uygulama çökmesin.
- Kiosk ekranında QR'ı sunucudan çekmek: QR cihazda `secret` ile üretilir (internet kesintisinde de çalışır).
