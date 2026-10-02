// SMS gönderimi. 1. aşamada gerçek SMS gitmez: mesaj kaydedilir ve sunucu konsoluna yazılır.
// Gerçek sağlayıcıya geçiş: `sendViaProvider` içini sağlayıcının HTTP API'siyle doldurun
// ve SMS_PROVIDER ortam değişkenini ayarlayın. Üretimde bu iş bir kuyruk (pg-boss) ile yapılmalı.

import { config } from "./config";
import { updateSms } from "./db/repo";
import type { Direction, SmsMessage, Student } from "./db/types";

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: config.timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "medium", timeZone: config.timeZone }).format(new Date(iso));
}

export function buildSmsBody(student: Student, direction: Direction, occurredAtIso: string, note?: string | null): string {
  const action = direction === "IN" ? "okula giris yapti" : "okuldan cikis yapti";
  const extra = note ? ` (${note})` : "";
  return `Sayin Veli, ${student.firstName} ${student.lastName} ${formatTime(occurredAtIso)}'de ${action}${extra}. - ${config.schoolShortName}`;
}

async function sendViaProvider(msg: SmsMessage): Promise<{ ok: boolean; providerMessageId?: string }> {
  // TODO(2. aşama): gerçek SMS sağlayıcısı entegrasyonu.
  console.log(`[sms:${config.smsProvider}] -> ${msg.phone}: ${msg.body}`);
  return { ok: true, providerMessageId: `mock-${msg.id}` };
}

export async function dispatchSms(messages: SmsMessage[]): Promise<void> {
  for (const msg of messages) {
    try {
      const r = await sendViaProvider(msg);
      await updateSms(msg.id, {
        status: r.ok ? (config.smsProvider === "mock" ? "MOCK_SENT" : "SENT") : "FAILED",
        providerMessageId: r.providerMessageId ?? null,
        attemptCount: msg.attemptCount + 1,
        sentAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[sms] gönderim hatası", e);
      await updateSms(msg.id, { status: "FAILED", attemptCount: msg.attemptCount + 1 });
    }
  }
}
