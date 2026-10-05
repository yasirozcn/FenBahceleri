// QR / BLE / istek imzası protokolü.
// AdminPanel'deki `src/lib/protocol.ts` ile BİREBİR aynı kurallar. Birini değiştirirseniz diğerini de güncelleyin.
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

// QR: FB2.<kioskId>.<slot>.<imza> — kiosk yönsüzdür; giriş/çıkışı sunucu belirler.
export const PROTOCOL_VERSION = "FB2";

const mac = (secretHex: string, message: string) => hmac(sha256, hexToBytes(secretHex), utf8ToBytes(message));

function base64url(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63];
  }
  return out;
}

export function slotAt(nowMs: number, slotSeconds: number): number {
  return Math.floor(nowMs / 1000 / slotSeconds);
}

export function buildQrPayload(secretHex: string, kioskId: string, slot: number): string {
  const sig = base64url(mac(secretHex, `${PROTOCOL_VERSION}|${kioskId}|${slot}`).slice(0, 16));
  return `${PROTOCOL_VERSION}.${kioskId}.${slot}.${sig}`;
}

export function isOurQr(payload: string): boolean {
  return payload.startsWith(`${PROTOCOL_VERSION}.`) && payload.split(".").length === 4;
}

export function bleToken(secretHex: string, kioskId: string, slot: number): string {
  return bytesToHex(mac(secretHex, `BLE|${kioskId}|${slot}`).slice(0, 8));
}

export function requestSignature(deviceSecretHex: string, qr: string, ble: string | null, timestamp: number): string {
  return bytesToHex(mac(deviceSecretHex, `${qr}|${ble ?? ""}|${timestamp}`));
}

// Test için dışa açık (AdminPanel ile uyumu doğrulamak amacıyla).
export const __test = { base64url };
