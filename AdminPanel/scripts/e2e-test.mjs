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
const kiosk = r.data?.kiosks?.[0];
check("kiosk listesi (tek, yönsüz kiosk)", !!kiosk && kiosk.direction === undefined, JSON.stringify(r.data?.kiosks));
const start = (await call("POST", `/api/mobile/kiosks/${kiosk.id}/start`, null, adminToken)).data;
const cfg = (await call("GET", "/api/mobile/config")).data;

const makeQr = (k, secret, slot) => `FB2.${k}.${slot}.${hmac(secret, `FB2|${k}|${slot}`).subarray(0, 16).toString("base64url")}`;
const ble = (k, secret, slot) => hmac(secret, `BLE|${k}|${slot}`).subarray(0, 8).toString("hex");
const slotNow = () => Math.floor(Date.now() / 1000 / 5);
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const scan = (qr, bleTok, { secret = deviceSecret, direction } = {}) => {
  const timestamp = Date.now();
  const signature = hmac(secret, `${qr}|${bleTok ?? ""}|${timestamp}`).toString("hex");
  return call("POST", "/api/mobile/scan", { qr, ble: bleTok ? { token: bleTok, rssi: -60 } : null, timestamp, signature, direction }, studentToken);
};
const goodScan = (opts) => {
  const s = slotNow();
  return scan(makeQr(kiosk.id, start.secret, s), ble(kiosk.id, start.secret, s), opts);
};

let slot = slotNow();
r = await scan(makeQr(kiosk.id, start.secret, slot - 10), null);
check("eski QR reddedilir", r.status === 422 && r.data?.code === "EXPIRED_QR", r.data?.code);
r = await scan(makeQr(kiosk.id, "00".repeat(32), slot), null);
check("sahte QR reddedilir", r.status === 422 && r.data?.code === "INVALID_QR", r.data?.code);
r = await scan(`FB1.${kiosk.id}.E.${slot}.xxxxxxxxxxxxxxxxxxxxxx`, null);
check("eski biçim (FB1) QR reddedilir", r.status === 422 && r.data?.code === "INVALID_QR", r.data?.code);
r = await scan(makeQr(kiosk.id, start.secret, slot), null, { secret: randomBytes(32).toString("hex") });
check("yanlış cihaz imzası reddedilir", r.data?.code === "BAD_SIGNATURE", r.data?.code);

r = await call("GET", "/api/mobile/student/me", null, studentToken);
check("ilk okutmadan önce yön sorulacak", r.data?.needsDirection === true && r.data?.nextDirection === null, JSON.stringify({ n: r.data?.needsDirection }));
r = await goodScan();
check("ilk okutma yön seçilmeden → DIRECTION_REQUIRED", r.status === 422 && r.data?.code === "DIRECTION_REQUIRED", r.data?.code);
slot = slotNow();
r = await scan(makeQr(kiosk.id, start.secret, slot), ble(kiosk.id, start.secret, slot), { direction: "IN" });
check("ilk okutma: seçilen yön (GİRİŞ)", r.status === 200 && r.data?.direction === "IN" && r.data?.bleVerified === true, JSON.stringify(r.data));
r = await scan(makeQr(kiosk.id, start.secret, slot), ble(kiosk.id, start.secret, slot));
check("aynı QR tekrar reddedilir (REPLAY)", r.data?.code === "REPLAY", r.data?.code);
// Yeni QR dilimine geçmeden aynı dilim tekrar okutulamaz (REPLAY); bu yüzden her okutmadan önce yeni dilim beklenir.
const waitNextSlot = async (minMs = 0) => {
  const t0 = Date.now();
  const s0 = slotNow();
  while (slotNow() === s0 || Date.now() - t0 < minMs) await sleep(200);
};
const win = cfg?.duplicateWindowSeconds ?? 120;
if (win >= 6) {
  await waitNextSlot();
  r = await goodScan({ direction: "OUT" });
  check(`çift okutma (${win} sn içinde) yeni kayıt açmaz, yön değişmez`, r.status === 200 && r.data?.duplicate === true && r.data?.direction === "IN", JSON.stringify(r.data));
  console.log(`- otomatik giriş/çıkış sırası testleri atlandı (DUPLICATE_WINDOW_SECONDS=${win}; test için sunucuyu DUPLICATE_WINDOW_SECONDS=2 ile başlatın)`);
} else {
  await waitNextSlot((win + 1) * 1000);
  r = await goodScan({ direction: "IN" }); // gönderilen yön yok sayılır
  check("ikinci okutma otomatik ÇIKIŞ (gönderilen yön yok sayılır)", r.status === 200 && r.data?.direction === "OUT" && !r.data?.duplicate, JSON.stringify(r.data));
  await waitNextSlot((win + 1) * 1000);
  r = await goodScan();
  check("üçüncü okutma otomatik GİRİŞ", r.status === 200 && r.data?.direction === "IN" && !r.data?.duplicate, JSON.stringify(r.data));
  r = await call("GET", "/api/mobile/student/me", null, studentToken);
  check("öğrenci okulda, sıradaki yön ÇIKIŞ", r.data?.student?.presenceStatus === "IN" && r.data?.nextDirection === "OUT" && r.data?.events?.length === 3);
  console.log(`- çift okutma testi atlandı (DUPLICATE_WINDOW_SECONDS=${win} < QR dilimi)`);
}
r = await call("GET", `/api/mobile/kiosks/${kiosk.id}/feed`, null, adminToken);
check("kiosk akışı", r.data?.events?.length >= 1 && r.data?.attempts?.length >= 1);

console.log(failures ? `\n${failures} test başarısız` : "\nTüm testler geçti");
process.exit(failures ? 1 : 0);
