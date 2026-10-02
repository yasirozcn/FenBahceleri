# Cihazla test: Android kiosk + iPhone öğrenci

```
 ┌─ Android telefon (KIOSK) ─┐        ┌─ iPhone (ÖĞRENCİ) ─┐
 │ APK (EAS ile derlenir)    │        │ geliştirme derlemesi│
 │ • dönen QR kod           │── QR ─▶│ • kamera            │
 │ • BLE yayını (service    │── BLE ▶│ • Bluetooth tarama  │
 │   data, 5 sn'de bir)     │        │                     │
 └────────────┬─────────────┘        └──────────┬──────────┘
              │            Wi-Fi                │
              └──────────▶  Mac  ◀──────────────┘
                 AdminPanel (npm run dev) + PostgreSQL
```

Üç cihaz da **aynı Wi-Fi**'da olmalı. Fotoğraf/selfie adımı yoktur.

---

## 0. Mac: sunucu

```bash
cd AdminPanel
npm run db:up
npm run dev
```

Mac'in IP'si: `ipconfig getifaddr en0` (şu an `192.168.1.120`). Bu adres hem APK'ya hem iPhone derlemesine gömülür.
IP değişirse yeniden derlemek gerekir; modem arayüzünden Mac'e **sabit IP (DHCP rezervasyonu)** vermek işinizi kolaylaştırır.

Sunucuya ulaşılabildiğini her telefonun tarayıcısında kontrol edin: `http://192.168.1.120:3000/api/mobile/config` → JSON görünmeli.

---

## 1. Android kiosk: APK'yı derleyip telefona kurmak

Derleme Expo'nun bulut servisi **EAS**'te yapılır; Mac'e Android Studio kurmanız gerekmez.

> Bu Mac'te Node, ağdaki güvenlik sertifikası yüzünden HTTPS hatası verebiliyor ("self-signed certificate in certificate chain").
> Komutların başındaki `NODE_OPTIONS=--use-system-ca` bunu çözer.

```bash
cd QrScannerApp

# (bir kez) Expo hesabı ve proje kaydı
NODE_OPTIONS=--use-system-ca npx eas-cli@latest login      # zaten girişliyse atlayın: npx eas-cli whoami
NODE_OPTIONS=--use-system-ca npx eas-cli@latest init
```

`eas init` proje kimliğini (projectId) kendisi yazamayıp "add this to your app config" derse, verdiği satırı `app.json` içinde `"extra"` altına ekleyin:

```json
"extra": {
  "apiUrl": "http://localhost:3000",
  "eas": { "projectId": "BURAYA-VERİLEN-KİMLİK" }
}
```

`eas.json` → `kiosk-lan` profilindeki adresin Mac'in güncel IP'si olduğundan emin olun, sonra:

```bash
NODE_OPTIONS=--use-system-ca npx eas-cli@latest build -p android --profile kiosk-lan
```

- "Generate a new Android Keystore?" → **Yes** (imzalama anahtarını EAS saklar).
- Ücretsiz planda kuyruk + derleme 10–30 dk sürebilir. İlerlemeyi terminaldeki bağlantıdan (expo.dev) izleyebilirsiniz.
- Bittiğinde terminalde bir **bağlantı ve QR kod** çıkar.

**Telefona kurulum**
1. Android telefonun kamerasıyla terminaldeki QR'ı okutun (veya bağlantıyı telefona gönderin) → **Install / Yükle** → APK iner.
2. İnen dosyayı açın. "Bilinmeyen uygulamalara izin ver" sorulursa tarayıcıya (Chrome) izin verin → **Yükle**.
3. Play Protect "tanınmayan uygulama" derse **Yine de yükle**.

Bu APK geliştirme sunucusu (Metro) gerektirmez; tek başına çalışır. Kod değiştiğinde yeni APK derlenir.

**Kiosk modunu açmak**
1. Uygulama → **Yönetici girişi (kiosk)** → `kapi@fenbahceleri.test` / `Kapi12345`.
2. **Ana Kapı Giriş**'i seçin.
3. İzinler: **Yakındaki cihazlar → İzin ver** (BLE yayını için gerekli). Bluetooth kapalıysa uygulama açmanızı ister.
4. Ekranda büyük QR ve altında **"BLE yayını açık"** görünmeli. Ekran kendiliğinden kapanmaz.

---

## 2. iPhone öğrenci: Bluetooth'lu geliştirme derlemesi

Expo Go'da Bluetooth **yoktur**; BLE testi için uygulama iPhone'a Xcode ile kurulur.

1. iPhone'u kabloyla Mac'e bağlayın → "Bu bilgisayara güven".
2. iPhone: Ayarlar → Gizlilik ve Güvenlik → **Geliştirici Modu** → Açık (telefon yeniden başlar).
3. `QrScannerApp/.env` → `EXPO_PUBLIC_API_URL=http://192.168.1.120:3000`
4. Mac'te:
   ```bash
   cd QrScannerApp
   npx expo run:ios --device
   ```
   - Listeden iPhone'u seçin. İlk derleme 5–10 dk.
   - "Signing requires a development team" hatası: `open ios/*.xcworkspace` → proje → **Signing & Capabilities** → *Team*: Apple hesabınız → komutu tekrar çalıştırın.
     Ücretsiz Apple hesabında bundle id alınamazsa `app.json` → `ios.bundleIdentifier`'ı benzersiz yapın (örn. `com.fenbahceleri.giris.yasir`).
   - iPhone "güvenilmeyen geliştirici" derse: Ayarlar → Genel → **VPN ve Cihaz Yönetimi** → sertifikanız → Güven.
5. Açılışta izinler: **Yerel Ağ**, **Bluetooth**, **Kamera** → İzin Ver.

Bu terminal açık kalmalı: uygulamanın tüm logları (`[BLE]`, `[api]`) burada akar.

---

## 3. Test senaryosu

### A) Bluetooth: iPhone kioskun yayınını duyuyor mu?
1. iPhone → açılış ekranı → **Bluetooth testi**.
2. Beklenen:
   - Bluetooth: `PoweredOn`
   - Tarama: `found`
   - Kiosk jetonu: `xxxxxxxxxxxxxxxx · service-data · RSSI -55 · 1 sn önce`
   - **Cihazlar** sekmesinde en üstte `★ KIOSK` (Android telefon). Jeton 5 sn'de bir değişir.
3. Telefonu kiosktan uzaklaştırın → RSSI düşer (−70, −85…); uzakta jeton gelmez. Bu değerler `BLE_REQUIRED` ve mesafe eşiği kararı için ölçümdür.
4. Mac terminalinde (Metro) aynı olaylar:
   ```
   [BLE] Bluetooth durumu: PoweredOn
   [BLE] Tarama başladı — kiosk servis kimliği 6f1b0000-…
   [BLE] KIOSK JETONU: 3fa1c09e7d2b4410 (service-data, RSSI -52, cihaz 1A2B3C4D…)
   [BLE] Özet: son 5 sn'de 180 paket, toplam 17 farklı cihaz; son jeton …
   ```

### B) Bluetooth kapalı uyarısı
iPhone Denetim Merkezi'nden Bluetooth'u kapatın → "Bluetooth kapalı" penceresi açılır; açınca kapanır.
Aynısı Android kioskta da geçerlidir (kiosk kapalı Bluetooth ile yayın yapamaz).

### C) Giriş
1. iPhone → **Öğrenci girişi** → `ali.yilmaz@fenbahceleri.test` → **Şifre oluşturun** (ilk giriş) → ana ekran.
2. Çıkış yapıp tekrar girin → **Şifre** ekranı.
3. Kayıtlı olmayan e-posta → "okul kayıtlarında bulunamadı".
4. Başka öğrenci e-postası → "Bu telefon başka bir öğrenci hesabına bağlı".

### D) QR + Bluetooth uçtan uca
1. iPhone → **QR okut** → Android'deki QR'ı okutun. Alt satırda yeşil **"Kiosk sinyali alındı"** olmalı.
2. Sonuç ekranı: **"Giriş kaydedildi"** + **"Bluetooth doğrulaması: kiosk doğrulandı ✓"**
   (telefonun duyduğu jeton sunucuda kioskun gizli anahtarıyla eşleşti).
3. Android kiosk ekranında öğrencinin adı birkaç saniye görünür.
4. Panel (http://localhost:3000, `admin@fenbahceleri.test` / `Admin12345`) → Canlı durum: öğrenci **Okulda**.
5. Çıkış: Android'de geri → **Ana Kapı Çıkış** → tekrar okutun.

### E) Hile denemeleri (isteğe bağlı)
- QR'ın ekran görüntüsünü alıp 20 sn sonra okutun → "süresi geçmiş" reddi; Panel → **Reddedilen okutmalar**.
- `BLE_REQUIRED=true` (AdminPanel `.env.local`) yapıp `npm run dev`'i yeniden başlatın → iPhone'da Bluetooth kapalıyken okutma reddedilir.

---

## Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| Android: "Sunucuya ulaşılamadı" | APK'ya gömülü IP eski olabilir (`eas.json` → `kiosk-lan`). Aynı Wi-Fi mi? Telefonun tarayıcısında `/api/mobile/config` açılıyor mu? |
| Android: "BLE yayını kapalı / hata" | Bluetooth açık mı, **Yakındaki cihazlar** izni verildi mi (Ayarlar → Uygulamalar → Fen Bahçeleri Giriş → İzinler)? Bazı eski/ucuz telefonlar BLE yayınını desteklemez. |
| iPhone: Bluetooth testi `unavailable` | Expo Go'da açılmış; `npx expo run:ios --device` ile kurulan uygulamayı kullanın. |
| iPhone: cihaz var, KIOSK yok | Kiosk ekranı açık mı, "BLE yayını açık" yazıyor mu? İki telefonu yan yana getirin. |
| "Giriş kaydedildi" ama BLE "sinyal yok" | Jeton 8 sn'den eski; kiosk yakınında okutun. |
| `eas build` "self-signed certificate" | Komutun başına `NODE_OPTIONS=--use-system-ca` ekleyin. |

## Android telefon yoksa

Mac de kiosk olabilir: `swift tools/mac-kiosk-beacon.swift` terminalde QR gösterir ve BLE yayını yapar (yerel ad "FB…" biçiminde; uygulama tanır). Bluetooth izni için macOS Terminal'e izin ister. Yalnızca QR için: `--no-ble`.
