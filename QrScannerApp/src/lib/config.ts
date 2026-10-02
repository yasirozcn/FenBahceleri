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

export const colors = {
  brand: "#1f7a4d",
  brandDark: "#124b2f",
  brandSoft: "#eef6f1",
  ink: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  bg: "#f8fafc",
  danger: "#b91c1c",
  dangerSoft: "#fef2f2",
  warn: "#b45309",
  warnSoft: "#fffbeb",
  white: "#ffffff",
};
