# TestFlight ile ilk testler — adım adım

Bu rehber, uygulamayı gerçek iPhone'lara TestFlight üzerinden dağıtmayı anlatır. Derleme Mac'te Xcode ile değil, Expo'nun bulut derleme servisi **EAS** ile yapılır; Xcode kurulu olmasa bile çalışır.

Kısa özet: **Apple Developer hesabı → sunucuyu HTTPS ile erişilebilir yap → `eas build` → `eas submit` → App Store Connect'te test kişilerini ekle.**

---

## 0. Başlamadan önce

| Gereken | Not |
| --- | --- |
| Apple Developer Program üyeliği | Yıllık ücretli. Okul/şirket adına açılacaksa D-U-N-S numarası gerekir ve onay birkaç hafta sürebilir; **şimdiden başvurun**. Denemeler için kişisel hesap da olur. |
| Expo hesabı | https://expo.dev — ücretsiz plan başlangıç için yeterli. |
| Node.js 20+ | Mac'inizde zaten var. |
| Test iPhone'u | Kiosk için ayrıca bir Android tablet (BLE yayını yalnızca Android'de). |

## 1. Sunucuyu (AdminPanel) telefonların erişebileceği hale getirin

TestFlight'taki uygulama `localhost`'a bağlanamaz. İki seçenek:

**A) Hızlı deneme — Mac'ten geçici HTTPS tüneli (önerilen ilk adım)**

```bash
# 1. terminal
cd FenBahceleri/AdminPanel
npm run build && npm start

# 2. terminal (Cloudflare'in ücretsiz, hesapsız geçici tüneli)
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

Çıktıdaki `https://....trycloudflare.com` adresini not edin. Mac açık ve iki terminal çalıştığı sürece telefonlar bu adrese ulaşır. Adres her çalıştırmada değişir; bu yüzden yalnızca kısa denemeler içindir ve **yalnızca test verisiyle** kullanılmalı.

**B) Kalıcı test sunucusu**

AdminPanel'i küçük bir sunucuya (tasarım dokümanındaki "Barındırma" bölümü) kurup bir alan adıyla HTTPS verin, örn. `https://test-panel.okulunuz.com`. Veritabanı olarak yönetilen PostgreSQL kullanın (`AdminPanel/POSTGRESQL_KURULUM.md`); fotoğraflar için sunucunun kalıcı diski olmalı (`UPLOAD_DIR`).

## 2. Sunucu adresini derlemeye yazın

`QrScannerApp/eas.json` içinde `production` profilindeki adresi değiştirin:

```json
"production": {
  "autoIncrement": true,
  "env": { "EXPO_PUBLIC_API_URL": "https://....trycloudflare.com" }
}
```

Bu adres derleme sırasında uygulamanın içine gömülür. Adres değişirse **yeni bir derleme** gerekir (ileride EAS Update ile yalnızca JS güncellenebilir).

## 3. EAS'e giriş ve projeyi bağlama

```bash
cd FenBahceleri/QrScannerApp
npm install
npx eas-cli@latest login
npx eas-cli@latest init          # app.json'a projectId ekler
```

Gerekirse `app.json`'daki `ios.bundleIdentifier` (`com.fenbahceleri.giris`) değerini kendi alan adınıza göre değiştirin. Bu kimlik App Store'da benzersiz olmalı ve **ilk yüklemeden sonra değiştirilemez**.

## 4. iOS derlemesi

```bash
npx eas-cli@latest build --platform ios --profile production
```

İlk derlemede EAS, Apple hesabınızla giriş yapmanızı ister ve sertifika, provisioning profile ve App Store Connect'teki uygulama kaydını sizin için oluşturmayı önerir; "Yes" deyin. Derleme bulutta ~15-25 dakika sürer; ilerlemeyi terminaldeki bağlantıdan izleyebilirsiniz.

Şifreleme sorusu için `app.json`'a `ITSAppUsesNonExemptEncryption: false` zaten eklendi (uygulama yalnızca standart HTTPS kullanıyor), bu yüzden her derlemede ihracat uyumu sorusu çıkmaz.

## 5. App Store Connect'e gönderme

```bash
npx eas-cli@latest submit --platform ios --latest
```

Gönderimden sonra Apple derlemeyi işler (genelde 5-30 dk). Hazır olduğunda App Store Connect'ten e-posta gelir.

## 6. Test kişilerini ekleme

https://appstoreconnect.apple.com → Uygulamam → **TestFlight** sekmesi.

| | İç test (Internal) | Dış test (External) |
| --- | --- | --- |
| Kimler | App Store Connect hesabınıza kullanıcı olarak eklenmiş kişiler (en fazla 100) | E-posta ile davet ya da herkese açık bağlantı (en fazla 10.000) |
| Apple incelemesi | Yok, derleme hazır olunca hemen | İlk derleme için "Beta App Review" gerekir (genelde 1 gün) |
| Kullanım | Siz ve ekibiniz | Pilot sınıftaki öğrenciler |

1. **İç test:** Users and Access'ten test edecek kişileri "Developer" veya "Marketing" rolüyle ekleyin → TestFlight → Internal Testing → grup oluşturun → derlemeyi ekleyin.
2. Testçiler iPhone'a App Store'dan **TestFlight** uygulamasını kurar, gelen daveti kabul eder ve uygulamayı yükler.
3. **Dış test (pilot sınıf):** External Testing → yeni grup → derlemeyi ekleyin → "Test Information" alanlarını doldurun. İnceleme ekibi için:
   - Bir **inceleme öğrencisi** e-postası ve kiosk hesabı verin. İnceleme öncesi panelden o öğrenci için **Cihazı sıfırla** yapın ki incelemeci kendi cihazında şifre oluşturabilsin.
   - İncelemecinin kiosk tableti olmayacağını not edin: "Yönetici girişi ile ikinci bir cihazda kiosk ekranını açıp öğrenci hesabıyla o QR okutulabilir" diye açıklayın.
4. Onaylanınca herkese açık TestFlight bağlantısını pilot sınıfla paylaşın.

TestFlight derlemeleri **90 gün** sonra geçersiz olur; pilot boyunca yeni derleme yüklemeniz gerekir.

## 7. Kiosk tableti (Android)

Kiosk için App Store'a gerek yok; tablete doğrudan APK kurun:

```bash
npx eas-cli@latest build --platform android --profile preview
```

`preview` profilindeki `EXPO_PUBLIC_API_URL`'yi de aynı sunucu adresine ayarlayın. Derleme bitince verilen bağlantıyı/QR'ı tabletten açıp APK'yı yükleyin (tablette "bilinmeyen kaynaklardan yükleme" izni istenecek). Uygulamada **Yönetici girişi** → `kapi@...` hesabı → kiosku seçin. Bluetooth'u açık tutun; alt satırda "BLE yayını açık" görünmeli.

Android telefonlu öğrenciler için aynı APK kullanılabilir; kalıcı dağıtım için Google Play "Dahili test" kanalı önerilir (bkz. tasarım dokümanı, "Uygulama dağıtımı").

## 8. İlk test senaryosu (kontrol listesi)

- [ ] Panelde (https://.../login) yönetici hesabıyla giriş → Öğrenciler → öğrencinin e-postası listede
- [ ] iPhone'da uygulama → Öğrenci girişi → e-posta → şifre oluştur
- [ ] Aynı iPhone'da başka öğrenci e-postası denenince "Bu telefon başka bir öğrenci hesabına bağlı" uyarısı
- [ ] Tablette kiosk ekranı açık → iPhone'dan **Giriş için QR okut** → "Giriş kaydedildi"
- [ ] Kiosk ekranında öğrencinin adı 4 sn görünüyor
- [ ] Panel → Canlı durum: öğrenci "Okulda"; Giriş-çıkışlar: kayıt görünüyor
- [ ] Panel → SMS kayıtları: veli mesajı (test modunda gerçekten gitmez)
- [ ] QR'ın fotoğrafını çekip 30 sn sonra başka telefondan okutma → "QR kodun süresi doldu" ve panelde Reddedilen okutmalar'da kayıt
- [ ] Panelden **Cihazı sıfırla** → uygulama yeniden açılınca "Cihaz bağlantısı kaldırıldı"
- [ ] BLE ölçümü: farklı telefonlarda kiosk sinyalinin kaç saniyede "alındı" olduğu (prototip hedefi)

BLE ölçümleri tatmin edici olunca sunucuda `BLE_REQUIRED=true` yaparak Bluetooth kanıtını zorunlu hale getirin.

## Sık karşılaşılan sorunlar

| Belirti | Çözüm |
| --- | --- |
| "Sunucuya ulaşılamadı" | `EXPO_PUBLIC_API_URL` doğru mu, tünel/sunucu açık mı? Adres `https://` ile başlamalı. Ana ekranın altındaki "Sunucu:" satırı derlemedeki adresi gösterir. |
| Kamera siyah | Ayarlar → Fen Bahçeleri Giriş → Kamera izni |
| "Kiosk sinyali aranıyor" hiç değişmiyor | Tablette BLE yayını açık mı, telefonda Bluetooth açık mı? iPhone kiosk olarak kullanılıyorsa BLE yayını yoktur (beklenen durum). |
| Derleme "bundle identifier already in use" | `app.json` → `ios.bundleIdentifier`'ı benzersiz bir değerle değiştirin. |
