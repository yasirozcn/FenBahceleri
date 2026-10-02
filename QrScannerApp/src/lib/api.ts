import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST"; body?: unknown; token?: string | null; timeoutMs?: number };

export async function api<T>(path: string, { method = "GET", body, token, timeoutMs = 15000 }: Options = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Gerçek hatayı logla: istek hiç gönderilemediyse (ör. gövde hazırlanamadı) bunu ağ hatasından ayırt edebilmek için.
    console.warn(`[api] ${method} ${path} başarısız:`, e);
    if (e instanceof Error && e.name === "AbortError") throw new ApiError(0, "Sunucu zamanında yanıt vermedi. Tekrar deneyin.", "TIMEOUT");
    throw new ApiError(0, "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.", "NETWORK");
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Beklenmeyen hata (${res.status}).`, data?.code ?? "ERROR");
  return data as T;
}


// ---- Yanıt tipleri
export type StudentSummary = { id: string; firstName: string; lastName: string; className: string };
export type AuthResponse = { token: string; student: StudentSummary };
export type MeResponse = {
  student: StudentSummary & { presenceStatus: "IN" | "OUT" };
  events: { id: string; direction: "IN" | "OUT"; occurredAt: string; kioskName: string | null }[];
};
export type ScanResponse = { eventId: string; direction: "IN" | "OUT"; occurredAt: string; time: string; duplicate: boolean; studentName: string; bleVerified: boolean | null };
export type AppConfig = { bleRequired: boolean; bleServiceUuid: string; slotSeconds: number; serverTime: number };
export type KioskInfo = { id: string; name: string; direction: "ENTRY" | "EXIT" };
export type KioskStart = { kiosk: KioskInfo; secret: string; slotSeconds: number; bleServiceUuid: string; bleRequired: boolean; serverTime: number };
export type KioskFeed = { serverTime: number; events: { id: string; name: string; className: string; direction: "IN" | "OUT"; occurredAt: string; time: string }[] };
