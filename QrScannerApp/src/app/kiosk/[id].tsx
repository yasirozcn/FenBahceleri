import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, PermissionsAndroid, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { KioskBeacon } from "@modules/kiosk-beacon";
import { Button, ErrorBox, Screen } from "@/components/ui";
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
    return buildQrPayload(start.secret, start.kiosk.id, start.kiosk.direction === "ENTRY" ? "E" : "X", slot);
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
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorBox message={error} />
          <Button title="Geri" onPress={() => router.back()} />
        </View>
      </Screen>
    );

  if (!start || !payload)
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );

  const landscape = width > height;
  const qrSize = Math.min(landscape ? height * 0.62 : width * 0.78, 520);
  const isEntry = start.kiosk.direction === "ENTRY";
  const bleText: Record<BleState, string> = {
    off: Platform.OS === "android" ? "Bluetooth kapalı veya yayın kullanılamıyor" : "BLE yayını yok",
    starting: "BLE başlatılıyor",
    on: "BLE yayını açık",
    unsupported: "BLE yayını yok (iOS kiosk)",
    error: `BLE hatası${KioskBeacon.lastError() ? `: ${KioskBeacon.lastError()}` : ""}`,
  };

  return (
    <Screen style={{ backgroundColor: "#fff" }}>
      <View style={{ flex: 1, flexDirection: landscape ? "row" : "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
        <View style={{ alignItems: landscape ? "flex-start" : "center", maxWidth: landscape ? width * 0.35 : undefined }}>
          <Text style={{ fontSize: 14, fontWeight: "700", letterSpacing: 1.5, color: colors.brand, textTransform: "uppercase" }}>Fen Bahçeleri</Text>
          <Text style={{ fontSize: 36, fontWeight: "800", color: colors.ink, marginTop: 4 }}>{isEntry ? "GİRİŞ" : "ÇIKIŞ"}</Text>
          <Text style={{ fontSize: 18, color: colors.muted, marginTop: 4, textAlign: landscape ? "left" : "center" }}>Okul uygulamasını açıp bu kodu okutun</Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 12 }}>{start.kiosk.name}</Text>
        </View>

        <View style={{ alignItems: "center" }}>
          <View style={{ padding: 16, backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: colors.line }}>
            <QRCode value={payload} size={qrSize} ecl="M" quietZone={8} />
          </View>
          <View style={{ width: qrSize, height: 6, backgroundColor: colors.line, borderRadius: 3, marginTop: 14, overflow: "hidden" }}>
            <View style={{ width: `${(remaining / slotSeconds) * 100}%`, height: 6, backgroundColor: colors.brand }} />
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>Kod {Math.ceil(remaining)} sn içinde yenilenecek</Text>
        </View>
      </View>

      {last && (
        <View style={{ position: "absolute", left: 20, right: 20, bottom: 70, backgroundColor: colors.brand, borderRadius: 16, padding: 18, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{last.name}</Text>
          <Text style={{ color: "#d5ebdd", fontSize: 18, marginTop: 4 }}>
            {last.className} · {last.direction === "IN" ? "Giriş" : "Çıkış"} ✓ {last.time}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: online ? colors.muted : colors.danger }}>
          {online ? "Sunucu bağlantısı var" : "Sunucuya ulaşılamıyor"} · {bleText[ble]}
        </Text>
        <Pressable onLongPress={exitKiosk} delayLongPress={1500} hitSlop={16}>
          <Text style={{ fontSize: 12, color: "#cbd5e1" }}>Çıkmak için basılı tutun</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
