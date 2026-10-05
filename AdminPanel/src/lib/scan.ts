// Okutma doğrulama iş kuralları (tasarım dokümanı: "Sunucunun doğruladığı" bölümü).

import { config } from "./config";
import {
  createEventWithSms,
  getActiveDevice,
  getKiosk,
  getStudent,
  insertScanAttempt,
  isReplay,
  lastEventForStudent,
  touchKiosk,
} from "./db/repo";
import type { AttendanceEvent, Direction, RejectReason } from "./db/types";
import { SLOT_TOLERANCE_FUTURE, SLOT_TOLERANCE_PAST, bleToken, currentSlot, parseQrPayload, qrSignature, requestSignature, safeEqual } from "./protocol";
import { buildSmsBody, dispatchSms } from "./sms";

export const REJECT_MESSAGES: Record<RejectReason, string> = {
  INVALID_QR: "Bu QR kod okul kioskuna ait değil.",
  EXPIRED_QR: "QR kodun süresi doldu. Ekrandaki güncel kodu okutun.",
  UNKNOWN_KIOSK: "Kiosk tanınmadı veya devre dışı.",
  BAD_SIGNATURE: "İstek doğrulanamadı. Uygulamayı güncelleyin veya tekrar giriş yapın.",
  DEVICE_NOT_BOUND: "Bu cihaz hesabınıza bağlı değil.",
  BLE_MISSING: "Kiosk Bluetooth sinyali algılanamadı. Bluetooth'u açıp kioska yaklaşın.",
  BLE_MISMATCH: "Kiosk Bluetooth sinyali doğrulanamadı. Kioska yaklaşıp tekrar deneyin.",
  REPLAY: "Bu kod bu cihazdan zaten okutuldu. Bir sonraki kodu bekleyin.",
  WRONG_STATE: "Durumunuz bu işleme uygun değil.",
  DIRECTION_REQUIRED: "İlk okutmanız: giriş mi çıkış mı yaptığınızı seçin.",
};

export type ScanInput = {
  studentId: string;
  deviceId: string;
  qr: string;
  ble: { token: string; rssi: number | null } | null;
  timestamp: number;
  signature: string;
  /** Yalnızca öğrencinin İLK okutmasında kullanılır (önceki kaydı yoksa). Sonrasında sunucu yönü kendisi belirler. */
  direction?: Direction | null;
};

export type ScanResult =
  | { ok: true; duplicate: boolean; event: AttendanceEvent; studentName: string; bleOk: boolean | null }
  | { ok: false; reason: RejectReason; message: string };

export async function processScan(input: ScanInput): Promise<ScanResult> {
  const base = {
    deviceId: input.deviceId,
    studentId: input.studentId,
    kioskId: null as string | null,
    timeSlot: null as number | null,
    bleToken: input.ble?.token ?? null,
    bleRssi: input.ble?.rssi ?? null,
    bleOk: null as boolean | null,
    integrityOk: null, // 2. aşama: Play Integrity / App Attest sonucu
  };
  // Sunucu terminalinde her okutma için tek satır (BLE sonucu dahil).
  const logScan = (outcome: string) =>
    console.log(
      `[scan] ${outcome} · öğrenci ${input.studentId} · kiosk ${base.kioskId ?? "?"} · BLE ${
        base.bleToken ? `${base.bleToken} RSSI ${base.bleRssi ?? "?"} → ${base.bleOk === null ? "kontrol edilmedi" : base.bleOk ? "EŞLEŞTİ" : "EŞLEŞMEDİ"}` : "jeton yok"
      }`,
    );
  const reject = async (reason: RejectReason, detail?: string): Promise<ScanResult> => {
    logScan(`REDDEDİLDİ (${reason})`);
    await insertScanAttempt({ ...base, result: "REJECTED", rejectReason: reason });
    return { ok: false, reason, message: detail ?? REJECT_MESSAGES[reason] };
  };

  // 1) Cihaz bu öğrenciye bağlı mı + istek imzası
  const device = await getActiveDevice(input.deviceId);
  if (!device || device.studentId !== input.studentId) return reject("DEVICE_NOT_BOUND");
  const expected = requestSignature(device.deviceSecret, input.qr, input.ble?.token ?? null, input.timestamp);
  if (!safeEqual(expected, input.signature)) return reject("BAD_SIGNATURE");

  // 2) QR biçimi, kiosk ve kiosk imzası
  const qr = parseQrPayload(input.qr);
  if (!qr) return reject("INVALID_QR");
  base.kioskId = qr.kioskId;
  base.timeSlot = qr.slot;
  const kiosk = await getKiosk(qr.kioskId);
  if (!kiosk || kiosk.status !== "ACTIVE") return reject("UNKNOWN_KIOSK");
  if (!safeEqual(qrSignature(kiosk.secret, kiosk.id, qr.slot), qr.sig)) return reject("INVALID_QR");

  // 3) Tazelik: sunucu saatine göre
  const now = currentSlot();
  if (qr.slot < now - SLOT_TOLERANCE_PAST || qr.slot > now + SLOT_TOLERANCE_FUTURE) return reject("EXPIRED_QR");

  // 4) BLE yakınlık kanıtı
  if (input.ble) {
    base.bleOk = safeEqual(bleToken(kiosk.secret, kiosk.id, qr.slot), input.ble.token) ||
      // kiosk yayını QR'dan bir dilim geride/ileride olabilir
      safeEqual(bleToken(kiosk.secret, kiosk.id, qr.slot - 1), input.ble.token) ||
      safeEqual(bleToken(kiosk.secret, kiosk.id, qr.slot + 1), input.ble.token);
    if (!base.bleOk && config.bleRequired) return reject("BLE_MISMATCH");
  } else if (config.bleRequired) {
    return reject("BLE_MISSING");
  }

  // 5) Tekrar oynatma (aynı cihaz + aynı kiosk + aynı dilim)
  if (await isReplay(input.deviceId, kiosk.id, qr.slot)) return reject("REPLAY");

  // 6) Yön: kiosk yönsüzdür.
  //    - Hiç kaydı olmayan öğrenci (ilk okutma) yönü uygulamada seçer → input.direction.
  //    - Sonrasında yön otomatik: okuldaysa ÇIKIŞ, dışarıdaysa GİRİŞ (presenceStatus'un tersi).
  //    - Son kayıttan sonra duplicateWindowSeconds içinde tekrar okutma yeni kayıt açmaz (çift okutma koruması).
  const student = await getStudent(input.studentId);
  if (!student || !student.isActive) return reject("DEVICE_NOT_BOUND", "Öğrenci kaydı aktif değil.");
  const last = await lastEventForStudent(student.id);
  const studentName = `${student.firstName} ${student.lastName}`;

  if (last && Date.now() - Date.parse(last.occurredAt) < config.duplicateWindowSeconds * 1000) {
    // Çift okutma: yeni olay ve SMS yok, mevcut olay döner.
    logScan(`KABUL (tekrar okutma, ${last.direction})`);
    await insertScanAttempt({ ...base, result: "ACCEPTED", rejectReason: null });
    return { ok: true, duplicate: true, event: last, studentName, bleOk: base.bleOk };
  }
  let direction: Direction;
  if (last) direction = student.presenceStatus === "IN" ? "OUT" : "IN";
  else if (input.direction) direction = input.direction;
  else {
    // Hile denemesi değil; kaydedilmez. Uygulama yön sorup aynı/yeni QR ile tekrar gönderir.
    logScan("YÖN GEREKLİ (ilk okutma)");
    return { ok: false, reason: "DIRECTION_REQUIRED", message: REJECT_MESSAGES.DIRECTION_REQUIRED };
  }

  logScan(`KABUL (${direction})`);
  const attempt = await insertScanAttempt({ ...base, result: "ACCEPTED", rejectReason: null });
  // Eş zamanlı iki istek aynı QR dilimini kullandıysa veritabanı ikincisini REPLAY olarak kaydeder.
  if (attempt.result !== "ACCEPTED") return { ok: false, reason: "REPLAY", message: REJECT_MESSAGES.REPLAY };
  await touchKiosk(kiosk.id);
  const occurredAt = new Date().toISOString();
  const { event, sms } = await createEventWithSms({
    studentId: student.id,
    direction,
    source: "APP",
    kioskId: kiosk.id,
    scanAttemptId: attempt.id,
    buildSms: (s) => buildSmsBody(s, direction, occurredAt),
  });
  // SMS gönderimi yanıtı bekletmesin.
  void dispatchSms(sms);
  return { ok: true, duplicate: false, event, studentName, bleOk: base.bleOk };
}

/** Panelden manuel giriş/çıkış (telefonu unutan öğrenci vb.). */
export async function manualEvent(studentId: string, direction: Direction, note: string): Promise<AttendanceEvent> {
  const occurredAt = new Date().toISOString();
  const { event, sms } = await createEventWithSms({
    studentId,
    direction,
    source: "MANUAL",
    kioskId: null,
    scanAttemptId: null,
    note,
    buildSms: (s) => buildSmsBody(s, direction, occurredAt),
  });
  void dispatchSms(sms);
  return event;
}
