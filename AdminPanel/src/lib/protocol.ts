// QR / BLE / istek imzası protokolü.
// Mobil uygulamadaki `src/lib/protocol.ts` ile BİREBİR aynı kuralları uygular.
// Birinde değişiklik yaparsanız diğerini de güncelleyin.
//
// QR içeriği:   FB1.<kioskId>.<E|X>.<slot>.<imza>
//   slot  = floor(unixSaniye / SLOT_SECONDS)
//   imza  = base64url( HMAC-SHA256(kioskSecret, "FB1|kioskId|E|slot") )[ilk 16 bayt]
// BLE jetonu: hex( HMAC-SHA256(kioskSecret, "BLE|kioskId|slot") )[ilk 8 bayt]
// İstek imzası: hex( HMAC-SHA256(deviceSecret, "qr|bleToken|timestamp") )

import { createHmac, timingSafeEqual } from "crypto";

export const PROTOCOL_VERSION = "FB1";
export const SLOT_SECONDS = 5;
/** Sunucunun kabul ettiği geçmiş dilim sayısı (ağ gecikmesi + saat farkı için). */
export const SLOT_TOLERANCE_PAST = 2;
export const SLOT_TOLERANCE_FUTURE = 1;
/** Kioskun BLE yayınında kullandığı servis kimliği (mobil uygulamada da aynı). */
export const BLE_SERVICE_UUID = "6f1b0000-5a1e-4c1a-9b9e-fb0000000001";

export type DirCode = "E" | "X";

export function currentSlot(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / SLOT_SECONDS);
}

function hmac(secretHex: string, message: string): Buffer {
  return createHmac("sha256", Buffer.from(secretHex, "hex")).update(message, "utf8").digest();
}

export function qrSignature(secretHex: string, kioskId: string, dir: DirCode, slot: number): string {
  return hmac(secretHex, `${PROTOCOL_VERSION}|${kioskId}|${dir}|${slot}`).subarray(0, 16).toString("base64url");
}

export function buildQrPayload(secretHex: string, kioskId: string, dir: DirCode, slot: number): string {
  return `${PROTOCOL_VERSION}.${kioskId}.${dir}.${slot}.${qrSignature(secretHex, kioskId, dir, slot)}`;
}

export function parseQrPayload(payload: string): { kioskId: string; dir: DirCode; slot: number; sig: string } | null {
  const parts = payload.trim().split(".");
  if (parts.length !== 5 || parts[0] !== PROTOCOL_VERSION) return null;
  const [, kioskId, dir, slotStr, sig] = parts;
  if (dir !== "E" && dir !== "X") return null;
  const slot = Number(slotStr);
  if (!Number.isInteger(slot) || !kioskId || !sig) return null;
  return { kioskId, dir, slot, sig };
}

export function bleToken(secretHex: string, kioskId: string, slot: number): string {
  return hmac(secretHex, `BLE|${kioskId}|${slot}`).subarray(0, 8).toString("hex");
}

export function requestSignature(deviceSecretHex: string, qr: string, ble: string | null, timestamp: number): string {
  return hmac(deviceSecretHex, `${qr}|${ble ?? ""}|${timestamp}`).toString("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
