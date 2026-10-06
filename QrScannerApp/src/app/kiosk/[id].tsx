import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, PermissionsAndroid, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { KioskBeacon } from "@modules/kiosk-beacon";
import { IconBluetooth, IconBluetoothOff, IconCheck } from "@/components/icons";
import { Button, ErrorBox, mono, Screen } from "@/components/ui";
import { api, ApiError, type KioskFeed, type KioskStart } from "@/lib/api";
import { bleLog } from "@/lib/ble";
import { colors } from "@/lib/config";
import { bleToken, buildQrPayload, slotAt } from "@/lib/protocol";
import { useSession } from "@/lib/session";

type BleState = "off" | "starting" | "on" | "unsupported" | "error";

async function ensureAdvertisePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const apiLevel = typeof Platform.Version === "number" ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (apiLevel < 31) return true;
  const r = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]);
  return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

// Kiosk ekranı: her dilimde (5 sn) yeni QR ve yeni BLE jetonu üretir.
// QR bu cihazda, sunucuyla paylaşılan gizli anahtardan hesaplanır; ekran internet kesilse bile kod üretmeye devam eder.
export default function KioskScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { adminToken, clearAdminSession } = useSession();
  const { width, height } = useWindowDimensions();
  const [start, setStart] = useState<KioskStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ble, setBle] = useState<BleState>("off");
  const [online, setOnline] = useState(true);
  const [last, setLast] = useState<KioskFeed["events"][number] | null>(null);
  const [offset, setOffset] = useState(0); // sunucu saati - cihaz saati
  const sinceRef = useRef<string | null>(null);
  const shownIds = useRef(new Set<string>());
  const advertisePermission = useRef<boolean | null>(null);

  // 1) Kiosk oturumunu başlat
  useEffect(() => {
    (async () => {
      try {
        const r = await api<KioskStart>(`/api/mobile/kiosks/${id}/start`, { method: "POST", token: adminToken });
        setOffset(r.serverTime - Date.now());
        sinceRef.current = new Date(r.serverTime).toISOString();
        setStart(r);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await clearAdminSession();
          router.replace("/admin-login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Kiosk başlatılamadı.");
      }
    })();
  }, [id, adminToken, clearAdminSession]);

  // 2) Saat (dilim değişimini yakalamak için)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const serverNow = now + offset;
  const slotSeconds = start?.slotSeconds ?? 5;
  const slot = slotAt(serverNow, slotSeconds);
  const remaining = slotSeconds - ((serverNow / 1000) % slotSeconds);

  const payload = useMemo(() => {
    if (!start) return null;
    return buildQrPayload(start.secret, start.kiosk.id, slot);
  }, [start, slot]);

  // 3) BLE yayını: her dilimde jetonu yenile (yalnızca Android + geliştirme/mağaza derlemesi)
  useEffect(() => {
    if (!start) return;
    let cancelled = false;
    (async () => {
      if (!KioskBeacon.isSupported()) {
        // Bluetooth kapalıysa da isSupported false döner.
        bleLog(`Kiosk yayını yapılamıyor: ${KioskBeacon.lastError() ?? (Platform.OS === "android" ? "Bluetooth kapalı veya BLE yayını desteklenmiyor" : "iOS yayın yapamaz")}`);
        setBle(Platform.OS === "android" ? "off" : "unsupported");
        return;
      }
      if (advertisePermission.current === null) advertisePermission.current = await ensureAdvertisePermission();
      if (!advertisePermission.current) {
        bleLog("Kiosk yayını: Yakındaki cihazlar (BLUETOOTH_ADVERTISE) izni verilmedi");
        setBle("error");
        return;
      }
      try {
        setBle((b) => (b === "on" ? b : "starting"));
        const token = bleToken(start.secret, start.kiosk.id, slot);
        await KioskBeacon.start(start.bleServiceUuid, token);
        const err = KioskBeacon.lastError();
        bleLog(err ? `Kiosk yayın HATASI: ${err} (dilim ${slot})` : `Kiosk yayında: jeton ${token} (dilim ${slot})`);
        if (!cancelled) setBle(err ? "error" : "on");
      } catch (e) {
        bleLog(`Kiosk yayını başlatılamadı: ${e instanceof Error ? e.message : String(e)}`);
        if (!cancelled) setBle("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start, slot]);

  useEffect(() => () => void KioskBeacon.stop(), []);

  // 4) Son okutanları göster (3 sn'de bir)
  useEffect(() => {
    if (!start) return;
    const poll = async () => {
      try {
        const r = await api<KioskFeed>(`/api/mobile/kiosks/${start.kiosk.id}/feed?since=${encodeURIComponent(sinceRef.current ?? "")}`, { token: adminToken, timeoutMs: 5000 });
        setOffset(r.serverTime - Date.now());
        setOnline(true);
        const fresh = r.events.filter((e) => !shownIds.current.has(e.id));
        if (fresh.length) {
          fresh.forEach((e) => shownIds.current.add(e.id));
          setLast(fresh[0]);
        }
      } catch {
        setOnline(false);
      }
    };
    const t = setInterval(poll, 3000);
    void poll();
    return () => clearInterval(t);
  }, [start, adminToken]);

  // Son okutan öğrenci 4 sn ekranda kalır
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), 4000);
    return () => clearTimeout(t);
  }, [last]);

  const exitKiosk = () =>
    Alert.alert("Kiosk modundan çık", "QR ekranı kapatılsın mı?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çık", style: "destructive", onPress: () => router.back() },
    ]);

  if (error)
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", width: "100%", maxWidth: 520, alignSelf: "center" }}>
          <ErrorBox message={error} />
          <Button title="Geri" onPress={() => router.back()} />
        </View>
      </Screen>
    );

  if (!start || !payload)
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      </Screen>
    );

  const landscape = width > height;
  const qrSize = Math.min(landscape ? height * 0.6 : width * 0.72, 480);
  const bleText: Record<BleState, string> = {
    off: Platform.OS === "android" ? "Bluetooth kapalı veya yayın kullanılamıyor" : "BLE yayını yok",
    starting: "BLE başlatılıyor",
    on: "BLE yayını açık",
    unsupported: "BLE yayını yok (iOS kiosk)",
    error: `BLE hatası${KioskBeacon.lastError() ? `: ${KioskBeacon.lastError()}` : ""}`,
  };

  const bleOk = ble === "on" || ble === "starting";
  const bleAlert = !bleOk && Platform.OS === "android"; // iOS kiosk yayın yapamaz; bu bir hata değil
  const initials = (last?.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
  const steps = ["Okul uygulamasını açın", "\"QR okut\"a basıp bu kodu okutun", "Adınızı ekranda görünce geçin"];

  return (
    <Screen padded={false} style={{ backgroundColor: colors.white }}>
      <View style={{ flex: 1, flexDirection: landscape ? "row" : "column" }}>
        {/* Yeşil bilgi paneli */}
        <View style={{ width: landscape ? Math.min(width * 0.375, 480) : "100%", backgroundColor: colors.brand, paddingHorizontal: landscape ? 40 : 24, paddingVertical: landscape ? 40 : 22, gap: landscape ? 24 : 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase", color: "#CFE4D6" }}>Fen Bahçeleri</Text>
            <Text style={{ fontSize: 20, fontWeight: "600", fontFamily: mono, color: colors.white }}>
              {new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(serverNow))}
            </Text>
          </View>

          {last ? (
            <View style={{ backgroundColor: colors.white, borderRadius: 26, padding: 24, alignItems: "center", gap: 14 }}>
              <View>
                <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: last.direction === "IN" ? colors.brandSoft : colors.exitSoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 44, fontWeight: "700", color: last.direction === "IN" ? colors.brand : colors.exit }}>{initials}</Text>
                </View>
                <View style={{ position: "absolute", right: -2, bottom: 4, width: 42, height: 42, borderRadius: 21, borderWidth: 4, borderColor: colors.white, backgroundColor: last.direction === "IN" ? colors.brand : colors.exit, alignItems: "center", justifyContent: "center" }}>
                  <IconCheck size={20} color={colors.white} />
                </View>
              </View>
              <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: last.direction === "IN" ? colors.brandSoft : colors.exitSoft }}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: last.direction === "IN" ? colors.brandDark : colors.exitInk }}>{last.direction === "IN" ? "Giriş" : "Çıkış"} ✓</Text>
              </View>
              <Text style={{ fontSize: 34, lineHeight: 38, fontWeight: "800", color: colors.ink, textAlign: "center" }}>{last.name}</Text>
              <Text style={{ fontSize: 19, color: colors.inkSoft }}>
                {last.className} · <Text style={{ fontFamily: mono, fontWeight: "600", color: colors.ink }}>{last.time}</Text>
              </Text>
            </View>
          ) : (
            <>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: landscape ? 64 : 40, lineHeight: landscape ? 62 : 42, fontWeight: "800", letterSpacing: -1.5, color: colors.white }}>{landscape ? "GİRİŞ\nÇIKIŞ" : "GİRİŞ · ÇIKIŞ"}</Text>
                <Text style={{ fontSize: 19, color: "#CFE4D6" }}>{start.kiosk.name}</Text>
              </View>
              {landscape && <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />}
              {landscape && (
                <View style={{ gap: 18 }}>
                  {steps.map((t, i) => (
                    <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 18, fontWeight: "700", fontFamily: mono, color: colors.brand }}>{i + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 20, fontWeight: "600", lineHeight: 26, color: colors.white }}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {landscape && <View style={{ flex: 1 }} />}
          <Text style={{ fontSize: 15, lineHeight: 22, color: "#CFE4D6" }}>Okul uygulamasını açıp bu kodu okutun. Giriş mi çıkış mı olduğunu sistem bilir.</Text>
        </View>

        {/* QR alanı */}
        <View style={{ flex: 1, paddingHorizontal: 32, paddingTop: 24 }}>
          {bleAlert && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.dangerSoft }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" }}>
                <IconBluetoothOff size={24} color={colors.white} />
              </View>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: "#5E120C" }}>{bleText[ble]}</Text>
            </View>
          )}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <View style={{ padding: 22, backgroundColor: colors.white, borderRadius: 28, borderWidth: 2, borderColor: colors.lineSoft }}>
              <QRCode value={payload} size={qrSize} ecl="M" quietZone={8} />
            </View>
            <View style={{ width: qrSize + 44, height: 8, backgroundColor: colors.lineSoft, borderRadius: 4, marginTop: 18, overflow: "hidden" }}>
              <View style={{ width: `${(remaining / slotSeconds) * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.brand }} />
            </View>
            <Text style={{ fontSize: 16, color: colors.inkSoft, marginTop: 10 }}>Kod {Math.ceil(remaining)} sn içinde yenilenecek</Text>
          </View>
          <View style={{ minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.lineSoft, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18, flexShrink: 1, flexWrap: "wrap" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: online ? colors.brand : colors.danger }} />
                <Text style={{ fontSize: 14, fontWeight: online ? "400" : "700", color: online ? colors.inkSoft : colors.danger }}>{online ? "Sunucu bağlantısı var" : "Sunucuya ulaşılamıyor"}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {bleOk ? <IconBluetooth size={18} color={colors.brand} /> : <IconBluetoothOff size={18} color={bleAlert ? colors.danger : colors.muted} />}
                <Text style={{ fontSize: 14, fontWeight: bleAlert ? "700" : "400", color: bleAlert ? colors.danger : colors.inkSoft }}>{bleText[ble]}</Text>
              </View>
            </View>
            <Pressable onLongPress={exitKiosk} delayLongPress={1500} hitSlop={16}>
              <Text style={{ fontSize: 13, color: colors.muted }}>Çıkmak için basılı tutun</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}
