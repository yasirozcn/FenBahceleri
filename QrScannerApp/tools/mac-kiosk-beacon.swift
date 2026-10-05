// Mac'i test kioskuna çevirir: terminalde dönen QR kodu gösterir ve BLE ile kiosk jetonunu yayınlar.
// Tek iPhone ile uçtan uca test için (kiosk tableti olmadan).
//
// Kullanım (AdminPanel çalışırken):
//   swift tools/mac-kiosk-beacon.swift --email KIOSK_EPOSTA                 (şifre ekranda gösterilmeden sorulur)
//   KIOSK_PASSWORD=... swift tools/mac-kiosk-beacon.swift --email KIOSK_EPOSTA   (şifre ortam değişkeninden)
//   swift tools/mac-kiosk-beacon.swift --api https://ALAN-ADI --email KIOSK_EPOSTA   (canlı sunucu)
//   swift tools/mac-kiosk-beacon.swift --kiosk KIOSK_ID      (verilmezse ilk aktif kiosk; yanlışsa mevcut liste yazılır)
// Şifreyi komut satırına veya bu dosyaya YAZMAYIN (kabuk geçmişine ve git'e girer).
//   swift tools/mac-kiosk-beacon.swift --no-ble        (yalnızca QR)
//
// Yayın biçimi: yerel ad "FB" + 16 hex jeton. (macOS/iOS "service data" yayınlayamaz; Android kiosk service data kullanır.
// Uygulamadaki tarayıcı ikisini de tanır — src/lib/ble.ts.) Jeton/QR üretimi src/lib/protocol.ts ile aynıdır.
//
// İlk çalıştırmada macOS, Terminal için Bluetooth izni ister. Reddedildiyse:
// Sistem Ayarları → Gizlilik ve Güvenlik → Bluetooth → Terminal'i açın.

import CoreBluetooth
import CoreImage
import CryptoKit
import Foundation

// ---------------------------------------------------------------- argümanlar

var opts: [String: String] = ["api": "http://localhost:3000", "email": "", "kiosk": ""]
var useBle = true
var argv = Array(CommandLine.arguments.dropFirst())
while !argv.isEmpty {
  let a = argv.removeFirst()
  if a == "--no-ble" { useBle = false; continue }
  if a.hasPrefix("--"), !argv.isEmpty { opts[String(a.dropFirst(2))] = argv.removeFirst() } else {
    print("Bilinmeyen argüman: \(a)"); exit(2)
  }
}

if opts["password"] != nil { print("Güvenlik: şifreyi --password ile vermeyin; KIOSK_PASSWORD ortam değişkenini kullanın ya da sorulduğunda girin."); exit(2) }
if opts["email"]!.isEmpty { print("Kiosk hesabının e-postasını verin: --email KIOSK_EPOSTA"); exit(2) }
let kioskPassword: String = {
  if let env = ProcessInfo.processInfo.environment["KIOSK_PASSWORD"], !env.isEmpty { return env }
  guard let p = getpass("\(opts["email"]!) şifresi: ") else { exit(2) }
  return String(cString: p)
}()

func log(_ s: String) {
  let f = DateFormatter(); f.dateFormat = "HH:mm:ss"
  let line = "\(f.string(from: Date())) \(s)"
  logLines.append(line)
  if logLines.count > 14 { logLines.removeFirst(logLines.count - 14) }
  print("\u{1B}[2m" + line + "\u{1B}[0m") // kaydırılan terminal geçmişinde de kalsın
}
var logLines: [String] = []

// ---------------------------------------------------------------- sunucu

func request(_ path: String, token: String? = nil, body: [String: Any]? = nil, method: String = "POST") -> [String: Any] {
  var req = URLRequest(url: URL(string: opts["api"]! + path)!)
  req.httpMethod = method
  req.setValue("application/json", forHTTPHeaderField: "Content-Type")
  if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
  if let body { req.httpBody = try! JSONSerialization.data(withJSONObject: body) }
  let sem = DispatchSemaphore(value: 0)
  var result: [String: Any] = [:]
  var failure: String?
  URLSession.shared.dataTask(with: req) { data, resp, err in
    defer { sem.signal() }
    if let err { failure = err.localizedDescription; return }
    let json = (try? JSONSerialization.jsonObject(with: data ?? Data())) as? [String: Any] ?? [:]
    if let http = resp as? HTTPURLResponse, http.statusCode >= 400 { failure = "\(http.statusCode) \(json["error"] ?? "")"; return }
    result = json
  }.resume()
  sem.wait()
  if let failure { print("Sunucu hatası (\(path)): \(failure)\nAdminPanel çalışıyor mu? (\(opts["api"]!))"); exit(1) }
  return result
}

print("Sunucuya bağlanılıyor: \(opts["api"]!) …")
let login = request("/api/mobile/admin/login", body: ["email": opts["email"]!, "password": kioskPassword])
let token = login["token"] as! String
// Kiosk seçimi: --kiosk verilmezse ilk aktif kiosk (canlıda kimlikler panelde oluşturulurken rastgele üretilir).
let kiosks = (request("/api/mobile/kiosks", token: token, method: "GET")["kiosks"] as? [[String: Any]]) ?? []
let chosen = opts["kiosk"]!.isEmpty
  ? kiosks.first
  : kiosks.first { ($0["id"] as? String) == opts["kiosk"] }
guard let chosen, let chosenId = chosen["id"] as? String else {
  print("Kiosk bulunamadı. Panelde kiosk ekleyin. Mevcut kiosklar (--kiosk ile seçin):")
  for k in kiosks { print("  \(k["id"] ?? "") — \(k["name"] ?? "")") }
  exit(1)
}
let start = request("/api/mobile/kiosks/\(chosenId)/start", token: token)
let kiosk = start["kiosk"] as! [String: Any]
let kioskId = kiosk["id"] as! String
let kioskName = kiosk["name"] as! String
let secretHex = start["secret"] as! String
let slotSeconds = (start["slotSeconds"] as! NSNumber).doubleValue
let offsetMs = (start["serverTime"] as! NSNumber).doubleValue - Date().timeIntervalSince1970 * 1000

// ---------------------------------------------------------------- protokol (src/lib/protocol.ts ile aynı)

func hexToData(_ hex: String) -> Data {
  var d = Data(); var i = hex.startIndex
  while i < hex.endIndex { let j = hex.index(i, offsetBy: 2); d.append(UInt8(hex[i..<j], radix: 16)!); i = j }
  return d
}
let key = SymmetricKey(data: hexToData(secretHex))
func mac(_ msg: String) -> Data { Data(HMAC<SHA256>.authenticationCode(for: Data(msg.utf8), using: key)) }
func base64url(_ d: Data) -> String {
  d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}
func currentSlot() -> Int { Int(floor((Date().timeIntervalSince1970 * 1000 + offsetMs) / 1000 / slotSeconds)) }
// Yönsüz kiosk QR'ı: FB2.<kioskId>.<slot>.<imza> (giriş/çıkışı sunucu belirler)
func qrPayload(_ slot: Int) -> String { "FB2.\(kioskId).\(slot).\(base64url(mac("FB2|\(kioskId)|\(slot)").prefix(16)))" }
func bleToken(_ slot: Int) -> String { mac("BLE|\(kioskId)|\(slot)").prefix(8).map { String(format: "%02x", $0) }.joined() }

// ---------------------------------------------------------------- terminalde QR

func qrLines(_ text: String) -> [String] {
  let f = CIFilter(name: "CIQRCodeGenerator")!
  f.setValue(Data(text.utf8), forKey: "inputMessage")
  f.setValue("M", forKey: "inputCorrectionLevel")
  let img = f.outputImage!
  let ext = img.extent.integral
  let w = Int(ext.width), h = Int(ext.height)
  var px = [UInt8](repeating: 0, count: w * h * 4)
  CIContext().render(img, toBitmap: &px, rowBytes: w * 4, bounds: ext, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
  let q = 2 // sessiz bölge
  func dark(_ x: Int, _ y: Int) -> Bool {
    let xx = x - q, yy = y - q
    if xx < 0 || yy < 0 || xx >= w || yy >= h { return false }
    return px[(yy * w + xx) * 4] < 128 // CIImage alttan yukarı; QR simetrik olmadığı için aşağıda ters çevrilir
  }
  let size = w + 2 * q
  var out: [String] = []
  // Her karakter üst üste iki modülü gösterir (▀: üst = ön plan rengi, alt = arka plan rengi).
  for row in stride(from: 0, to: size, by: 2) {
    var line = ""
    for x in 0..<size {
      let top = dark(x, size - 1 - row), bottom = row + 1 < size ? dark(x, size - 2 - row) : false
      line += "\u{1B}[38;5;\(top ? 16 : 231)m\u{1B}[48;5;\(bottom ? 16 : 231)m▀"
    }
    out.append(line + "\u{1B}[0m")
  }
  return out
}

// ---------------------------------------------------------------- BLE yayını

final class Beacon: NSObject, CBPeripheralManagerDelegate {
  var pm: CBPeripheralManager!
  var current: String?
  var state = "başlatılıyor"
  override init() { super.init(); pm = CBPeripheralManager(delegate: self, queue: .main) }

  func peripheralManagerDidUpdateState(_ p: CBPeripheralManager) {
    switch p.state {
    case .poweredOn: state = "açık"; log("Bluetooth açık"); if let c = current { advertise(c) }
    case .poweredOff: state = "KAPALI"; log("Bluetooth kapalı — Mac'te Bluetooth'u açın")
    case .unauthorized: state = "İZİN YOK"; log("Bluetooth izni yok — Sistem Ayarları → Gizlilik ve Güvenlik → Bluetooth → Terminal")
    case .unsupported: state = "desteklenmiyor"; log("Bu Mac BLE yayını desteklemiyor")
    default: state = "\(p.state.rawValue)"
    }
  }

  func advertise(_ token: String) {
    current = token
    guard pm.state == .poweredOn else { return }
    pm.stopAdvertising()
    pm.startAdvertising([CBAdvertisementDataLocalNameKey: "FB\(token)"])
  }

  func peripheralManagerDidStartAdvertising(_ p: CBPeripheralManager, error: Error?) {
    if let error { log("Yayın HATASI: \(error.localizedDescription)") } else { log("Yayında: FB\(current ?? "")") }
  }
}

let beacon: Beacon? = useBle ? Beacon() : nil

// ---------------------------------------------------------------- okutma logu (sunucudan)
// Kiosk akışını 2 sn'de bir çeker; bu kioskta yapılan her okutmayı (kabul/red) ve BLE sonucunu loga yazar.

let feedSince = ISO8601DateFormatter().string(from: Date())
var seenAttempts = Set<String>()
var feedFailing = false

func pollFeed() {
  let since = feedSince.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? feedSince
  var req = URLRequest(url: URL(string: "\(opts["api"]!)/api/mobile/kiosks/\(kioskId)/feed?since=\(since)")!)
  req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
  req.timeoutInterval = 5
  URLSession.shared.dataTask(with: req) { data, _, err in
    let json = (try? JSONSerialization.jsonObject(with: data ?? Data())) as? [String: Any]
    DispatchQueue.main.async {
      guard err == nil, let attempts = json?["attempts"] as? [[String: Any]] else {
        if !feedFailing { log("Sunucuya ulaşılamıyor — okutma logu durdu (\(err?.localizedDescription ?? "geçersiz yanıt"))") }
        feedFailing = true
        return
      }
      if feedFailing { log("Sunucu bağlantısı geri geldi") }
      feedFailing = false
      var changed = false
      for a in attempts.reversed() {
        guard let id = a["id"] as? String, !seenAttempts.contains(id) else { continue }
        seenAttempts.insert(id)
        changed = true
        let name = a["studentName"] as? String ?? "?"
        let ok = (a["result"] as? String) == "ACCEPTED"
        let ble: String
        if let tok = a["bleToken"] as? String {
          let rssi = (a["bleRssi"] as? NSNumber).map { "RSSI \($0)" } ?? "RSSI ?"
          let verdict = (a["bleOk"] as? Bool).map { $0 ? "eşleşti ✓" : "EŞLEŞMEDİ ✗" } ?? "kontrol edilmedi"
          ble = "BLE \(tok) \(rssi) \(verdict)"
        } else {
          ble = "BLE jetonu YOK (telefon yayını duymadı)"
        }
        log(ok ? "OKUTMA ✓ \(name) — \(ble)" : "OKUTMA ✗ \(name) — reddedildi: \(a["rejectReason"] as? String ?? "?") — \(ble)")
      }
      if changed, lastSlot >= 0 { render(lastSlot) }
    }
  }.resume()
}
let feedTimer = Timer(timeInterval: 2, repeats: true) { _ in pollFeed() }
RunLoop.main.add(feedTimer, forMode: .common)
var lastSlot = -1

func render(_ slot: Int) {
  let payload = qrPayload(slot)
  var s = "\u{1B}[H\u{1B}[2J"
  s += "\(kioskName) (\(kioskId)) — giriş/çıkış kiosku · sunucu \(opts["api"]!)\n\n"
  s += qrLines(payload).joined(separator: "\n") + "\n\n"
  s += "Dilim \(slot) · QR \(payload)\n"
  s += useBle ? "BLE: \(beacon!.state) · yerel ad FB\(bleToken(slot))\n" : "BLE: kapalı (--no-ble)\n"
  s += "\nSon olaylar:\n" + logLines.map { "  " + $0 }.joined(separator: "\n") + "\n\nÇıkmak için Ctrl+C"
  print(s)
}

let timer = Timer(timeInterval: 0.25, repeats: true) { _ in
  let slot = currentSlot()
  if slot != lastSlot {
    lastSlot = slot
    let t = bleToken(slot)
    if let beacon { beacon.advertise(t) }
    // Yayın sonucunun log'a düşmesi için çizimi biraz geciktir.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { render(slot) }
  }
}
RunLoop.main.add(timer, forMode: .common)
log("Kiosk oturumu başladı (dilim \(Int(slotSeconds)) sn)")
RunLoop.main.run()
