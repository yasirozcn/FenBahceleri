import Constants from "expo-constants";

/**
 * Sunucu (AdminPanel) adresi.
 * - Geliştirme: `.env` dosyasına EXPO_PUBLIC_API_URL=http://<Mac'in yerel IP'si>:3000 yazın.
 * - TestFlight / mağaza: HTTPS adresi zorunludur (örn. https://panel.okulunuz.com).
 */
export const API_URL: string = (
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:3000"
).replace(/\/$/, "");

// Tasarım sistemi (Claude Design · "Fen Bahçeleri Giriş-Çıkış").
// Var olan anahtarlar korunur; yalnızca değerler ve birkaç yeni ton eklendi.
export const colors = {
  brand: "#17613C",
  brandDark: "#0F4A2C",
  brandSoft: "#E3EFE6",
  ink: "#14211A",
  inkSoft: "#4A564F",
  muted: "#6B7570",
  line: "#DDDAD0",
  lineSoft: "#ECEAE3",
  lineStrong: "#C9C5B8",
  bg: "#F4F3EE",
  danger: "#B42318",
  dangerSoft: "#FCE8E6",
  dangerInk: "#8F1C13",
  dangerLine: "#F1B8B2",
  warn: "#9A5B00",
  warnSoft: "#FBF0DC",
  warnInk: "#7A4700",
  exit: "#1E4FA8",
  exitSoft: "#E4ECF8",
  exitInk: "#173E85",
  white: "#ffffff",
};
