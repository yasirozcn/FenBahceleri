import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// Cihaz kimliği ve cihaz anahtarı telefonun güvenli deposunda (iOS Keychain / Android Keystore) tutulur.
// 1. aşama: cihaz anahtarı yazılımla üretilir. 2. aşamada donanım anahtarı (Secure Enclave / StrongBox)
// ve Play Integrity / App Attest ile değiştirilecek (tasarım dokümanı: "Cihaz ve kimlik güvenliği").

const K = {
  deviceId: "fb.deviceId",
  deviceSecret: "fb.deviceSecret",
  boundEmail: "fb.boundEmail",
  studentToken: "fb.studentToken",
  adminToken: "fb.adminToken",
};

const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export type DeviceIdentity = { deviceId: string; deviceSecret: string };

let cached: DeviceIdentity | null = null;

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (cached) return cached;
  let deviceId = await SecureStore.getItemAsync(K.deviceId, opts);
  let deviceSecret = await SecureStore.getItemAsync(K.deviceSecret, opts);
  if (!deviceId || !deviceSecret) {
    deviceId = Crypto.randomUUID();
    const bytes = Crypto.getRandomBytes(32);
    deviceSecret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(K.deviceId, deviceId, opts);
    await SecureStore.setItemAsync(K.deviceSecret, deviceSecret, opts);
  }
  cached = { deviceId, deviceSecret };
  return cached;
}

/** Bu telefona bağlanmış öğrencinin e-postası (bir telefonda tek öğrenci). */
export const getBoundEmail = () => SecureStore.getItemAsync(K.boundEmail, opts);
export const setBoundEmail = (email: string) => SecureStore.setItemAsync(K.boundEmail, email.trim().toLowerCase(), opts);
/** Yönetici cihazı sıfırladıysa telefonun yerel bağlantısı da temizlenir. */
export async function clearBinding() {
  await SecureStore.deleteItemAsync(K.boundEmail, opts);
  await SecureStore.deleteItemAsync(K.studentToken, opts);
}

export const tokens = {
  getStudent: () => SecureStore.getItemAsync(K.studentToken, opts),
  setStudent: (t: string) => SecureStore.setItemAsync(K.studentToken, t, opts),
  clearStudent: () => SecureStore.deleteItemAsync(K.studentToken, opts),
  getAdmin: () => SecureStore.getItemAsync(K.adminToken, opts),
  setAdmin: (t: string) => SecureStore.setItemAsync(K.adminToken, t, opts),
  clearAdmin: () => SecureStore.deleteItemAsync(K.adminToken, opts),
};
