// Uygulama ayarları. Ortam değişkenleriyle (.env.local) değiştirilebilir.
export const config = {
  /** JWT imzalama anahtarı. Üretimde mutlaka uzun, rastgele bir değer verin. */
  authSecret: process.env.AUTH_SECRET ?? "dev-only-secret-change-me-dev-only-secret-change-me",
  /** true ise kioskun BLE jetonu olmadan okutma reddedilir. Prototip ölçümlerinden sonra açın. */
  bleRequired: process.env.BLE_REQUIRED === "true",
  /** Son kayıttan sonra bu süre içinde tekrar okutma yeni olay oluşturmaz (yön değişmez; çift okutma koruması). */
  duplicateWindowSeconds: Number(process.env.DUPLICATE_WINDOW_SECONDS ?? 120),
  /** "mock": SMS'ler yalnızca kaydedilir ve konsola yazılır. İleride "netgsm", "iletimerkezi" vb. */
  smsProvider: process.env.SMS_PROVIDER ?? "mock",
  schoolShortName: process.env.SCHOOL_SHORT_NAME ?? "Fen Bahceleri",
  timeZone: "Europe/Istanbul",
};

if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  console.warn("[config] UYARI: AUTH_SECRET tanımlı değil; varsayılan geliştirme anahtarı kullanılıyor.");
}
