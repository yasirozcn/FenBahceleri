// Öğrenci telefonunda kioskun BLE yayınını dinler.
// react-native-ble-plx yerel modül gerektirir; Expo Go'da yoktur. O durumda tarama sessizce devre dışı kalır
// ve okutma BLE'siz gönderilir (sunucuda BLE_REQUIRED=false iken kabul edilir).
//
// Kiosk jetonu (8 bayt, 5 sn'de bir değişir) iki biçimde tanınır:
//  1) Android kiosk: servis kimliği altında "service data" (asıl biçim)
//  2) iOS / macOS yayıncı: yerel ad "FB" + 16 hex karakter (Apple cihazları service data yayınlayamaz;
//     tek iPhone ile test için Mac'teki tools/mac-kiosk-beacon.swift bu biçimi kullanır)
//
// Tüm olaylar `[BLE]` önekiyle konsola (Metro terminali / Xcode) ve uygulamadaki "Bluetooth testi" ekranına yazılır.
import { Linking, PermissionsAndroid, Platform } from "react-native";

export type BtState = "unavailable" | "Unknown" | "Resetting" | "Unsupported" | "Unauthorized" | "PoweredOff" | "PoweredOn";
export type Found = { token: string; rssi: number | null; at: number; source: "service-data" | "local-name"; deviceId: string };
export type BleStatus = "unavailable" | "no-permission" | "off" | "scanning" | "found";

// ---------------------------------------------------------------- log

export type BleLogEntry = { at: number; msg: string };
const LOG_MAX = 300;
const logEntries: BleLogEntry[] = [];
const logListeners = new Set<() => void>();

export function bleLog(msg: string) {
  const entry = { at: Date.now(), msg };
  logEntries.push(entry);
  if (logEntries.length > LOG_MAX) logEntries.splice(0, logEntries.length - LOG_MAX);
  console.log(`[BLE] ${msg}`);
  logListeners.forEach((l) => l());
}
export const getBleLog = () => logEntries.slice();
export function clearBleLog() {
  logEntries.length = 0;
  logListeners.forEach((l) => l());
}
export function subscribeBleLog(fn: () => void): () => void {
  logListeners.add(fn);
  return () => void logListeners.delete(fn);
}

// ---------------------------------------------------------------- yönetici ve durum

let manager: any = null; // react-native-ble-plx BleManager (yalnızca yerel derlemede)
let available: boolean | null = null;

function getManager() {
  if (available === false) return null;
  if (manager) return manager;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require("react-native-ble-plx");
    manager = new BleManager();
    available = true;
    bleLog(`BleManager oluşturuldu (${Platform.OS} ${Platform.Version})`);
    return manager;
  } catch (e) {
    available = false;
    bleLog(`Yerel BLE modülü yok (Expo Go?) — BLE devre dışı. ${e instanceof Error ? e.message : ""}`);
    return null;
  }
}

export const isBleAvailable = () => getManager() !== null;

async function ensureAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const api = typeof Platform.Version === "number" ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (api >= 31) {
    const r = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]);
    bleLog(`Android izinleri: ${JSON.stringify(r)}`);
    return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  bleLog(`Android konum izni: ${r}`);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** Bluetooth durumunu dinler (ilk değer hemen gelir). iOS'ta ilk çağrı Bluetooth izin penceresini açar. */
export function subscribeBtState(fn: (s: BtState) => void): () => void {
  const m = getManager();
  if (!m) {
    fn("unavailable");
    return () => {};
  }
  let last: string | null = null;
  const sub = m.onStateChange((s: BtState) => {
    if (s !== last) bleLog(`Bluetooth durumu: ${s}`);
    last = s;
    fn(s);
  }, true);
  return () => sub?.remove();
}

/** Kullanıcıyı Bluetooth'u açabileceği yere götürür. */
export async function openBluetoothSettings(state: BtState) {
  bleLog(`Kullanıcı Bluetooth ayarlarına yönlendirildi (durum: ${state})`);
  if (Platform.OS === "android") {
    try {
      if (state === "PoweredOff") await Linking.sendIntent("android.bluetooth.adapter.action.REQUEST_ENABLE");
      else await Linking.openSettings();
      return;
    } catch {
      await Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS").catch(() => Linking.openSettings());
      return;
    }
  }
  // iOS, uygulamaların doğrudan Bluetooth ayarını açmasına izin vermez; uygulamanın ayar sayfası açılır.
  await Linking.openSettings();
}

// ---------------------------------------------------------------- jeton çözme

function base64ToHex(b64: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  let bits = 0;
  let value = 0;
  let hex = "";
  for (const c of clean) {
    value = (value << 6) | chars.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      hex += ((value >> bits) & 0xff).toString(16).padStart(2, "0");
    }
  }
  return hex;
}

const LOCAL_NAME_RE = /^FB([0-9a-fA-F]{16})$/;

type ScannedDevice = {
  id: string;
  name?: string | null;
  localName?: string | null;
  rssi?: number | null;
  serviceUUIDs?: string[] | null;
  serviceData?: Record<string, string> | null;
  manufacturerData?: string | null;
};

/** Reklam paketinden kiosk jetonunu çıkarır; yoksa null. */
export function extractKioskToken(device: ScannedDevice, serviceUuid: string): Omit<Found, "at"> | null {
  const target = serviceUuid.toLowerCase();
  for (const [uuid, b64] of Object.entries(device.serviceData ?? {})) {
    if (uuid.toLowerCase() !== target || !b64) continue;
    const token = base64ToHex(b64);
    if (token.length === 16) return { token, rssi: device.rssi ?? null, source: "service-data", deviceId: device.id };
  }
  const m = LOCAL_NAME_RE.exec(device.localName ?? "");
  if (m) return { token: m[1].toLowerCase(), rssi: device.rssi ?? null, source: "local-name", deviceId: device.id };
  return null;
}

// ---------------------------------------------------------------- tarama

export type SeenDevice = { id: string; name: string | null; rssi: number | null; services: string[]; hasServiceData: boolean; hasManufacturerData: boolean; lastSeen: number; count: number; isKiosk: boolean };

type ScanOptions = {
  /** Çevredeki tüm cihazların listesi (Bluetooth testi ekranı için). */
  onDevices?: (devices: SeenDevice[]) => void;
  /** true: her reklam paketini loga yazar (çok gürültülü). */
  verbose?: boolean;
};

/**
 * Taramayı başlatır. `onUpdate` durum değişince ve her yeni jetonda çağrılır. Dönen fonksiyon taramayı durdurur.
 */
export async function startBleScan(serviceUuid: string, onUpdate: (status: BleStatus, latest: Found | null) => void, opts: ScanOptions = {}): Promise<() => void> {
  const m = getManager();
  if (!m) {
    onUpdate("unavailable", null);
    return () => {};
  }
  if (!(await ensureAndroidPermissions())) {
    bleLog("Tarama başlatılamadı: izin verilmedi");
    onUpdate("no-permission", null);
    return () => {};
  }

  let latest: Found | null = null;
  let stopped = false;
  let scanning = false;
  let packets = 0;
  const seen = new Map<string, SeenDevice>();
  let summaryTimer: ReturnType<typeof setInterval> | null = null;
  let devicesTimer: ReturnType<typeof setInterval> | null = null;

  const stopScan = () => {
    if (!scanning) return;
    scanning = false;
    try {
      m.stopDeviceScan();
    } catch {
      // yoksay
    }
    if (summaryTimer) clearInterval(summaryTimer);
    if (devicesTimer) clearInterval(devicesTimer);
    bleLog(`Tarama durdu (toplam ${packets} paket, ${seen.size} cihaz)`);
  };

  const begin = () => {
    if (stopped || scanning) return;
    scanning = true;
    onUpdate(latest ? "found" : "scanning", latest);
    bleLog(`Tarama başladı — kiosk servis kimliği ${serviceUuid}, filtre yok, allowDuplicates=true`);

    summaryTimer = setInterval(() => {
      const kiosk = latest ? `son jeton ${latest.token} (${latest.source}, RSSI ${latest.rssi}, ${Math.round((Date.now() - latest.at) / 1000)} sn önce)` : "kiosk jetonu henüz yok";
      bleLog(`Özet: son 5 sn'de ${packets} paket, toplam ${seen.size} farklı cihaz; ${kiosk}`);
      packets = 0;
    }, 5000);
    if (opts.onDevices) {
      devicesTimer = setInterval(() => opts.onDevices?.(Array.from(seen.values()).sort((a, b) => Number(b.isKiosk) - Number(a.isKiosk) || (b.rssi ?? -999) - (a.rssi ?? -999))), 1000);
    }

    // Filtre verilmez: Android kioskun yayınında servis kimliği yalnızca "service data" içinde bulunur.
    Promise.resolve(
      m.startDeviceScan(null, { allowDuplicates: true }, (error: { message?: string; errorCode?: number } | null, device: ScannedDevice | null) => {
        if (error) {
          bleLog(`Tarama hatası: ${error.message ?? "?"} (kod ${error.errorCode ?? "?"})`);
          return;
        }
        if (!device) return;
        packets++;
        const found = extractKioskToken(device, serviceUuid);
        const name = device.localName ?? device.name ?? null;
        const prev = seen.get(device.id);
        if (!prev) {
          bleLog(
            `Yeni cihaz: ${name ?? "(adsız)"} id=${device.id.slice(0, 8)}… RSSI=${device.rssi} servisler=${(device.serviceUUIDs ?? []).join(",") || "-"}${device.serviceData ? " +serviceData" : ""}${device.manufacturerData ? " +manufacturerData" : ""}`,
          );
        } else if (opts.verbose) {
          bleLog(`Paket: ${name ?? "(adsız)"} RSSI=${device.rssi}`);
        }
        seen.set(device.id, {
          id: device.id,
          name,
          rssi: device.rssi ?? null,
          services: device.serviceUUIDs ?? [],
          hasServiceData: !!device.serviceData,
          hasManufacturerData: !!device.manufacturerData,
          lastSeen: Date.now(),
          count: (prev?.count ?? 0) + 1,
          isKiosk: !!found || !!prev?.isKiosk,
        });
        if (found) {
          if (!latest || latest.token !== found.token) bleLog(`KIOSK JETONU: ${found.token} (${found.source}, RSSI ${found.rssi}, cihaz ${found.deviceId.slice(0, 8)}…)`);
          latest = { ...found, at: Date.now() };
          onUpdate("found", latest);
        }
      }),
    ).catch((e: unknown) => {
      bleLog(`startDeviceScan başarısız: ${e instanceof Error ? e.message : String(e)}`);
      onUpdate("unavailable", latest);
    });
  };

  const unsubscribe = subscribeBtState((s) => {
    if (s === "PoweredOn") begin();
    else if (s === "Unauthorized") {
      stopScan();
      onUpdate("no-permission", latest);
    } else if (s === "PoweredOff" || s === "Unsupported") {
      stopScan();
      onUpdate("off", latest);
    }
  });

  return () => {
    stopped = true;
    unsubscribe();
    stopScan();
  };
}
