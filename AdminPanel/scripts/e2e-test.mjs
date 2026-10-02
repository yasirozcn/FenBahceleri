// Uçtan uca API testi: mobil uygulamanın yaptığı çağrıları taklit eder.
// Kullanım: sunucu çalışırken `node scripts/e2e-test.mjs` (varsayılan http://localhost:3000)
import { createHmac, randomBytes, randomUUID } from "crypto";

const BASE = process.env.API_URL ?? "http://localhost:3000";
const hmac = (hex, msg) => createHmac("sha256", Buffer.from(hex, "hex")).update(msg).digest();
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failures++;
};
async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const email = "ali.yilmaz@fenbahceleri.test";
const deviceId = randomUUID();
const deviceSecret = randomBytes(32).toString("hex");

let r = await call("POST", "/api/mobile/student/check-email", { email, deviceId });
check("e-posta kontrolü: ilk giriş → şifre oluştur", r.data?.next === "create-password", JSON.stringify(r.data));
r = await call("POST", "/api/mobile/student/check-email", { email: "yok@x.test", deviceId });
check("kayıtsız e-posta reddedilir", r.status === 404);
r = await call("POST", "/api/mobile/student/set-password", { email, password: "kisa", deviceId, deviceSecret, platform: "ios" });
check("kısa şifre reddedilir", r.status === 400);
r = await call("POST", "/api/mobile/student/set-password", { email, password: "OgrenciSifre1", deviceId, deviceSecret, platform: "ios" });
check("şifre oluşturma + cihaz bağlama", r.status === 200 && !!r.data?.token, JSON.stringify(r.data?.error ?? ""));
const studentToken = r.data?.token;
r = await call("POST", "/api/mobile/student/set-password", { email, password: "BaskaSifre99", deviceId, deviceSecret, platform: "ios" });
check("şifre ikinci kez oluşturulamaz", r.status === 409 && r.data?.code === "ALREADY_HAS_PASSWORD", r.data?.code);
r = await call("POST", "/api/mobile/student/check-email", { email, deviceId });
check("e-posta kontrolü: sonraki giriş → şifre", r.data?.next === "password", JSON.stringify(r.data));
r = await call("POST", "/api/mobile/student/check-email", { email, deviceId: randomUUID() });
check("başka telefondan e-posta girişi reddedilir", r.status === 403 && r.data?.code === "WRONG_DEVICE", r.data?.code);

r = await call("POST", "/api/mobile/student/check-email", { email: "zeynep.kaya@fenbahceleri.test", deviceId });
check("aynı cihaza ikinci öğrenci bağlanamaz", r.status === 409);
r = await call("POST", "/api/mobile/student/login", { email, password: "OgrenciSifre1", deviceId: randomUUID() });
check("başka cihazdan giriş reddedilir", r.status === 403);
r = await call("POST", "/api/mobile/student/login", { email, password: "OgrenciSifre1", deviceId });
check("kendi cihazından şifreyle giriş", r.status === 200);

r = await call("POST", "/api/mobile/admin/login", { email: "kapi@fenbahceleri.test", password: "Kapi12345" });
check("kiosk yönetici girişi", r.status === 200);
const adminToken = r.data?.token;
r = await call("GET", "/api/mobile/kiosks", null, adminToken);
const entry = r.data?.kiosks?.find((k) => k.direction === "ENTRY");
const exit = r.data?.kiosks?.find((k) => k.direction === "EXIT");
check("kiosk listesi", !!entry && !!exit);
const start = (await call("POST", `/api/mobile/kiosks/${entry.id}/start`, null, adminToken)).data;
const startExit = (await call("POST", `/api/mobile/kiosks/${exit.id}/start`, null, adminToken)).data;

const makeQr = (k, secret, dir, slot) => `FB1.${k}.${dir}.${slot}.${hmac(secret, `FB1|${k}|${dir}|${slot}`).subarray(0, 16).toString("base64url")}`;
const ble = (k, secret, slot) => hmac(secret, `BLE|${k}|${slot}`).subarray(0, 8).toString("hex");
const slotNow = () => Math.floor(Date.now() / 1000 / 5);
const scan = (qr, bleTok, secret = deviceSecret) => {
  const timestamp = Date.now();
  const signature = hmac(secret, `${qr}|${bleTok ?? ""}|${timestamp}`).toString("hex");
  return call("POST", "/api/mobile/scan", { qr, ble: bleTok ? { token: bleTok, rssi: -60 } : null, timestamp, signature }, studentToken);
};

let slot = slotNow();
r = await scan(makeQr(entry.id, start.secret, "E", slot - 10), null);
check("eski QR reddedilir", r.status === 422 && r.data?.code === "EXPIRED_QR", r.data?.code);
r = await scan(makeQr(entry.id, "00".repeat(32), "E", slot), null);
check("sahte QR reddedilir", r.status === 422 && r.data?.code === "INVALID_QR", r.data?.code);
r = await scan(makeQr(entry.id, start.secret, "E", slot), null, randomBytes(32).toString("hex"));
check("yanlış cihaz imzası reddedilir", r.data?.code === "BAD_SIGNATURE", r.data?.code);
r = await scan(makeQr(entry.id, start.secret, "E", slot), ble(entry.id, start.secret, slot));
check("geçerli giriş okutması", r.status === 200 && r.data?.direction === "IN", JSON.stringify(r.data));
r = await scan(makeQr(entry.id, start.secret, "E", slot), null);
check("aynı QR tekrar reddedilir", r.data?.code === "REPLAY", r.data?.code);

slot = slotNow();
r = await scan(makeQr(exit.id, startExit.secret, "X", slot), null);
check("çıkış okutması", r.status === 200 && r.data?.direction === "OUT", JSON.stringify(r.data));
r = await call("GET", "/api/mobile/student/me", null, studentToken);
check("öğrenci durumu dışarıda", r.data?.student?.presenceStatus === "OUT" && r.data?.events?.length === 2);
r = await call("GET", `/api/mobile/kiosks/${entry.id}/feed`, null, adminToken);
check("kiosk akışı", r.data?.events?.length >= 1);

console.log(failures ? `\n${failures} test başarısız` : "\nTüm testler geçti");
process.exit(failures ? 1 : 0);
