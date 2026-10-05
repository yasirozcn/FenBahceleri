# Canlıya alma — AWS Lightsail (en düşük maliyet)

## Mimari

```
 iPhone (öğrenci)  ─┐                        AWS Lightsail sunucusu (Frankfurt, tek makine, Docker)
                    │   HTTPS (443)        ┌──────────────────────────────────────────────────────┐
 Android (kiosk)   ─┼──────────────────────▶ Caddy ──▶ AdminPanel (Next.js) ──▶ PostgreSQL       │
                    │   https://ALAN-ADI    │ (HTTPS     (panel + mobil API)    (yalnızca iç ağ;  │
 Tarayıcı (panel)  ─┘                       │  sertifika)                        dışarı kapalı)    │
                                            └──────────────────────────────────────────────────────┘
```

- **Uygulama veritabanına doğrudan bağlanmaz.** Telefonlar yalnızca `https://ALAN-ADI/api/mobile/...` adresine istek atar.
  Veritabanı şifresi hiçbir telefonda bulunmaz; veritabanı portu internete açık değildir.
- Telefonların bildiği tek şey sunucu adresidir (`EXPO_PUBLIC_API_URL`); derlerken uygulamanın içine gömülür.
- Panel, mobil API, veritabanı ve HTTPS aynı sunucuda Docker ile çalışır: `AdminPanel/deploy/`.

## Maliyet

| Kalem | Aylık | Not |
| --- | --- | --- |
| Lightsail Linux **1 GB RAM / 2 vCPU / 40 GB SSD / 2 TB trafik** | **7 $** | Genel IPv4 adresi pakete dahil. Yeni hesaplarda seçili paketler **ilk 3 ay ücretsiz** (hesap başına bir paket). |
| Statik IP | 0 $ | Bir sunucuya bağlı olduğu sürece ücretsiz. **Boşta bırakmayın.** |
| HTTPS sertifikası (Let's Encrypt, Caddy) | 0 $ | Otomatik alınır ve yenilenir. |
| Alan adı | 0 $ | `IP.sslip.io` ücretsiz adres. İsterseniz kendi alan adınız (~10 $/yıl). |
| Günlük veritabanı yedeği (sunucu diskinde) | 0 $ | `yedek-al.sh`, cron ile her gece. |
| Lightsail otomatik anlık görüntü (snapshot) | ~0,5–1 $ | İsteğe bağlı ama önerilir; kullanılan GB başına ~0,05 $. |
| **Toplam** | **≈ 7–8 $/ay** | İlk 3 ay ≈ 0–1 $ |

Neden RDS değil: RDS PostgreSQL'in en küçüğü (db.t4g.micro) tek başına ~12 $/ay + disk + ayrıca uygulama sunucusu + IPv4 (3,65 $/ay) → ~25 $+/ay.
Okul ölçeğinde (yüzlerce öğrenci, günde birkaç bin istek) tek Lightsail sunucusu fazlasıyla yeterli: yerel ölçümde panel + veritabanı + Caddy toplam ~100 MB RAM kullanıyor.

> 5 $'lık plan artık 0,5 GB RAM veriyor. Çalışır ama sunucuda derleme (`next build`) çok yavaşlar; 7 $'lık plan önerilir.

---

## 0. AWS hesabı ve harcama alarmı (bir kez, 5 dk)

1. https://aws.amazon.com → hesap açın (kredi kartı gerekir).
2. **Bütçe alarmı** — beklenmedik ücrete karşı: Konsol → **Billing and Cost Management → Budgets → Create budget** → *Monthly cost budget* → tutar **10 $** → e-posta adresiniz. Aylık 10 $'ı geçecek gibi olursa e-posta gelir.
3. Kök hesapta **MFA** açın (sağ üst ad → Security credentials → Assign MFA).

## 1. Sunucuyu oluşturun (Lightsail)

1. https://lightsail.aws.amazon.com → **Create instance**.
2. **Bölge: Frankfurt (eu-central-1)** — öğrenci verisi AB'de kalsın (KVKK), Türkiye'ye de yakın.
3. Platform **Linux/Unix** → Blueprint: **OS Only → Ubuntu 24.04 LTS**.
4. Plan: **Dual-stack, 7 $/ay (1 GB RAM)**. "First 3 months free" etiketi varsa o plan ücretsiz başlar.
5. Ad: `fenbahceleri` → **Create instance**.

**Statik IP** (sunucu yeniden başlasa da adres değişmesin):
6. Lightsail → **Networking → Create static IP** → aynı bölge → sunucuya bağlayın (*Attach*). Örnek: `3.121.45.67`.

**Güvenlik duvarı**:
7. Sunucu → **Networking** sekmesi → IPv4 Firewall: **HTTPS (443)** kuralı ekleyin. Liste şöyle olmalı:
   - SSH 22, HTTP 80, HTTPS 443. Başka port **açmayın** (veritabanı 5432 kapalı kalmalı).

## 2. Sunucuyu hazırlayın (bir kez, ~5 dk)

Sunucu sayfasında **Connect using SSH** (tarayıcıda terminal açılır):

```bash
git clone https://github.com/yasirozcn/FenBahceleri.git
cd FenBahceleri/AdminPanel/deploy
bash sunucu-hazirla.sh          # 2 GB swap, Docker, saat dilimi, gece 03:30 yedeği
exit                            # Docker izni için oturumu kapatın, sonra tekrar "Connect using SSH"
```

## 3. Ayarlar (.env)

```bash
cd ~/FenBahceleri/AdminPanel/deploy
cp .env.example .env
openssl rand -hex 32            # → AUTH_SECRET
openssl rand -hex 24            # → POSTGRES_PASSWORD
nano .env
```

```ini
DOMAIN=3-121-45-67.sslip.io     # statik IP'nin noktaları tireye çevrilmiş hali (kendi alan adınız varsa onu yazın)
AUTH_SECRET=<ilk komutun çıktısı>
POSTGRES_PASSWORD=<ikinci komutun çıktısı>
BLE_REQUIRED=false              # Bluetooth'u zorunlu yapmak için true
SMS_PROVIDER=mock
SCHOOL_SHORT_NAME=Fen Bahceleri
```

Kaydet: `Ctrl+O`, Enter, `Ctrl+X`. **Bu iki şifreyi bir şifre yöneticisine de kaydedin.**
`POSTGRES_PASSWORD` ilk çalıştırmadan sonra değiştirilmez (veritabanı bu şifreyle oluşturulur).

## 4. Çalıştırın

```bash
docker compose up -d --build    # ilk sefer 5–10 dk (derleme). Sonraki açılışlar saniyeler.
docker compose ps               # db, app, caddy → running
docker compose logs app | head  # "Şema uygulandı: 11 tablo" görünmeli
```

Kontrol (kendi bilgisayarınızın tarayıcısında):
- `https://3-121-45-67.sslip.io/api/mobile/config` → JSON
- `https://3-121-45-67.sslip.io/login` → panel giriş sayfası (kilit simgesi = geçerli HTTPS)

Sertifika ilk istekte birkaç saniyede alınır. Hata alırsanız: `docker compose logs caddy` (çoğunlukla 80/443 portu güvenlik duvarında kapalıdır).

## 5. İlk hesaplar (canlıda örnek veri yoktur)

```bash
# Panel yöneticisi (şifre sorulur, en az 10 karakter)
docker compose exec app node scripts/create-admin.mjs --email mudur@okulunuz.com --name "Okul Yöneticisi" --role ADMIN
# Kiosk tableti hesabı (yalnızca uygulamada QR ekranını açar, panele giremez)
docker compose exec app node scripts/create-admin.mjs --email kapi@okulunuz.com --name "Ana Kapı Tableti" --role KIOSK
```

Aynı komut aynı e-postayla tekrar çalıştırılırsa şifre güncellenir (şifre unutulursa).
Betik doğrudan veritabanına (`admin_users` tablosu) yazar; tek farkı şifreyi panelin beklediği bcrypt özetine çevirmesidir. SQL ile eklemek isterseniz önce özeti üretmeniz gerekir (bkz. 5b).

Ardından panelde (`https://ALAN-ADI/login`):
1. **Kiosklar** → "Ana Kapı" ekleyin. Kiosk yönsüzdür: aynı QR hem giriş hem çıkış için okutulur (öğrenci ilk okutmada yönü seçer, sonra sistem sırayla giriş/çıkış kaydeder). Eski kurulumda ayrı "Giriş/Çıkış" kioskları varsa birini **Devre dışı bırak**ın.
2. **Öğrenciler** → öğrencileri e-posta ve veli telefonuyla ekleyin.

## 5b. Veritabanına erişim

Veritabanı sunucudaki Docker'da çalışır; 5432 portu **yalnızca sunucunun kendisine** açıktır (internetten erişilemez, Lightsail güvenlik duvarında da açmayın).

**A) Sunucunun terminalinden (en hızlı)** — Lightsail → Connect using SSH:
```bash
cd ~/FenBahceleri/AdminPanel/deploy
docker compose exec db psql -U fb_app -d fenbahceleri
```
```sql
\dt                                         -- tablolar
SELECT full_name, email, role FROM admin_users;
SELECT first_name, last_name, email, class_name FROM students;
\q
```

**B) Kendi bilgisayarınızdan görsel programla (TablePlus / DBeaver / Postico), SSH tüneliyle:**
1. Lightsail → sağ üst **Account → SSH keys** → bölgenin (Frankfurt) **varsayılan anahtarını indirin** (`LightsailDefaultKey-eu-central-1.pem`).
   Mac'te: `chmod 600 ~/Downloads/LightsailDefaultKey-eu-central-1.pem`
2. Veritabanı şifresi: sunucuda `grep POSTGRES_PASSWORD ~/FenBahceleri/AdminPanel/deploy/.env`
3. TablePlus → yeni PostgreSQL bağlantısı → **Over SSH**:

| Alan | Değer |
| --- | --- |
| Host / Port | `127.0.0.1` / `5432` |
| User / Database | `fb_app` / `fenbahceleri` |
| Password | `.env`'deki `POSTGRES_PASSWORD` |
| SSH Server / Port | `18.196.144.201` (statik IP) / `22` |
| SSH User | `ubuntu` |
| SSH Key | indirdiğiniz `.pem` dosyası |

Program önce SSH ile sunucuya girer, oradan sunucunun içindeki veritabanına bağlanır; veritabanı internete hiç açılmaz.

> Canlı veritabanında elle değişiklik yapmadan önce `bash yedek-al.sh` ile yedek alın.
> Şifreler `password_hash` kolonunda bcrypt özeti olarak durur; elle yazılamaz — yönetici şifresi için `create-admin.mjs`, öğrenci şifresi için paneldeki **Şifreyi sıfırla** kullanılır.

## 6. Yedekleme

- **Her gece 03:30** `deploy/yedek/fb-TARİH.sql.gz` alınır, 14 gün tutulur. Elle: `bash yedek-al.sh`
- **Sunucu tamamen bozulursa diye** Lightsail → sunucu → **Snapshots → Automatic snapshots: Enabled** (günlük, ~0,5–1 $/ay).
- Ara sıra bir yedeği kendi bilgisayarınıza indirin:
  `scp ubuntu@3.121.45.67:~/FenBahceleri/AdminPanel/deploy/yedek/fb-*.sql.gz .`
  (SSH anahtarı: Lightsail → Account → SSH keys → varsayılan anahtarı indirin, `scp -i anahtar.pem ...`)

Geri yükleme:
```bash
gunzip -c yedek/fb-20261004-0330.sql.gz | docker compose exec -T db psql -U fb_app -d fenbahceleri
```

## 7. Güncelleme (kod değiştiğinde)

Mac'te değişikliği GitHub'a gönderdikten sonra sunucuda:
```bash
cd ~/FenBahceleri && git pull
cd AdminPanel/deploy && docker compose up -d --build
```
Şema değişiklikleri (`db/schema.sql`) uygulama açılırken otomatik uygulanır. Kesinti birkaç saniyedir.

---

## 8. Uygulamayı canlı sunucuya bağlamak

Uygulama sunucu adresini derleme anında içine gömer. Adres değiştiği için **bir kez yeniden derleyip kurmak** gerekir; sonrasında Mac'e hiç gerek kalmaz (telefonlar Wi-Fi veya mobil veriyle her yerden çalışır).

1. `QrScannerApp/.env`:
   ```
   EXPO_PUBLIC_API_URL=https://3-121-45-67.sslip.io
   ```
   (Sonda `/` olmasın. HTTPS olduğu için yerel ağ izni ve Android'in `http` engeli sorunları da ortadan kalkar.)

2. **iPhone (öğrenci)** — telefon kabloyla bağlı, kilidi açık:
   ```bash
   cd ~/Projects/FenBahceleri/QrScannerApp
   bash tools/ios-kur.sh
   ```
   Release sürümü derlenir ve telefona kurulur. Ücretli geliştirici hesabıyla imzalandığı için süre sınırı yok (profil 1 yıl geçerli).

3. **Android (kiosk)** — Java 17 kurulu, telefon USB hata ayıklamayla bağlı:
   ```bash
   cd ~/Projects/FenBahceleri/QrScannerApp
   bash tools/android-apk.sh
   ```
   `fen-bahceleri-kiosk.apk` oluşur ve telefona kurulur. Kablo yoksa APK'yı telefona gönderip açarak kurun.

4. Kullanım:
   - **Android:** Yönetici girişi → `kapi@okulunuz.com` → kiosk seçin → Bluetooth/yakındaki cihazlar izni → QR ekranı.
   - **iPhone:** Öğrenci girişi → panelde eklediğiniz öğrencinin e-postası → şifre oluştur → QR okut.

> iPhone'da eski sürüm (Mac'teki test sunucusuna bağlı) kuruluysa, yeni kurulum onun yerine geçer. Telefondaki oturum yeni sunucuda geçersiz olduğu için tekrar giriş istenir; öğrenci kaydı yeni veritabanında olduğundan ilk girişte şifre oluşturulur.

## 9. Sonra (isteğe bağlı)

- **Kendi alan adı** (`panel.okulunuz.com`): DNS'te A kaydı → statik IP; `.env`'de `DOMAIN`'i değiştirip `docker compose up -d`; uygulamaları yeni adresle yeniden derleyin.
- **TestFlight / Google Play**: öğrencilerin telefonlarına dağıtım için (bkz. `QrScannerApp/TESTFLIGHT.md`). Sunucu HTTPS olduğu için hazır.
- **Gerçek SMS sağlayıcısı**: `SMS_PROVIDER` (2. aşama).
