import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { IconAlert, IconArrowRight, IconBack, IconBluetooth, IconBluetoothOff, IconCamera, IconCheck, IconIn, IconInfo, IconOut, IconX } from "@/components/icons";
import { Button, ErrorBox, mono, Screen, styles, TopBar } from "@/components/ui";
import { api, ApiError, type MeResponse, type ScanResponse } from "@/lib/api";
import { bleLog, startBleScan, type BleStatus, type Found } from "@/lib/ble";
import { colors } from "@/lib/config";
import { getDeviceIdentity } from "@/lib/device";
import { isOurQr, requestSignature } from "@/lib/protocol";
import { useSession } from "@/lib/session";

type Phase = "scan" | "sending" | "done" | "error";

const BLE_FRESH_MS = 8000;

const bleLabel: Record<BleStatus, string> = {
  unavailable: "Bluetooth doğrulaması bu sürümde kapalı",
  "no-permission": "Bluetooth izni verilmedi",
  off: "Bluetooth kapalı",
  scanning: "Kiosk sinyali aranıyor…",
  found: "Kiosk sinyali alındı",
};

export default function Scan() {
  const { studentToken, config, refreshConfig } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("scan");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [bleStatus, setBleStatus] = useState<BleStatus>("scanning");
  // Kiosk yönsüz: ilk okutmada öğrenci yönü seçer, sonrasında sunucu otomatik belirler.
  const [needsDirection, setNeedsDirection] = useState<boolean | null>(null);
  const [nextDirection, setNextDirection] = useState<"IN" | "OUT" | null>(null);
  const [chosenDirection, setChosenDirection] = useState<"IN" | "OUT" | null>(null);
  const ble = useRef<Found | null>(null);
  const busy = useRef(false);

  // BLE taraması: okutma ekranı açık olduğu sürece kioskun yayınını dinler.
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const cfg = config ?? (await refreshConfig());
      if (!cfg || cancelled) return;
      stop = await startBleScan(cfg.bleServiceUuid, (status, latest) => {
        setBleStatus(status);
        if (latest) ble.current = latest;
      });
      if (cancelled) stop();
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [config, refreshConfig]);

  useEffect(() => {
    api<MeResponse>("/api/mobile/student/me", { token: studentToken })
      .then((r) => {
        setNeedsDirection(r.needsDirection);
        setNextDirection(r.nextDirection);
      })
      .catch(() => setNeedsDirection(false)); // sunucu yine de DIRECTION_REQUIRED derse aşağıda sorulur
  }, [studentToken]);

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    if (busy.current || phase !== "scan") return;
    if (!isOurQr(data)) {
      setHint("Bu QR kod okul kioskuna ait değil.");
      return;
    }
    const freshBle = ble.current && Date.now() - ble.current.at < BLE_FRESH_MS ? ble.current : null;
    bleLog(
      `QR okundu: ${data.slice(0, 40)}… — gönderilecek BLE jetonu: ${freshBle ? `${freshBle.token} (${Math.round((Date.now() - freshBle.at) / 1000)} sn önce, RSSI ${freshBle.rssi})` : ble.current ? `yok (son jeton ${Math.round((Date.now() - ble.current.at) / 1000)} sn önce, bayat)` : "yok (hiç alınmadı)"}`,
    );
    if (config?.bleRequired && !freshBle) {
      setHint("Kiosk Bluetooth sinyali bekleniyor. Bluetooth'un açık olduğundan emin olup kioska yaklaşın.");
      return;
    }
    busy.current = true;
    setHint(null);
    setPhase("sending");
    try {
      const { deviceSecret } = await getDeviceIdentity();
      const timestamp = Date.now();
      const bleToken = freshBle?.token ?? null;
      const r = await api<ScanResponse>("/api/mobile/scan", {
        method: "POST",
        token: studentToken,
        body: {
          qr: data,
          ble: freshBle ? { token: freshBle.token, rssi: freshBle.rssi } : null,
          timestamp,
          signature: requestSignature(deviceSecret, data, bleToken, timestamp),
          direction: chosenDirection, // yalnızca ilk okutmada dikkate alınır
        },
      });
      bleLog(`Sunucu okutmayı kabul etti: ${r.direction}${r.duplicate ? " (tekrar)" : ""} — BLE doğrulaması: ${r.bleVerified === null ? "jeton gönderilmedi" : r.bleVerified ? "EŞLEŞTİ ✓" : "EŞLEŞMEDİ ✗"}`);
      setResult(r);
      setPhase("done");
    } catch (e) {
      bleLog(`Sunucu okutmayı reddetti: ${e instanceof ApiError ? `${e.code} — ${e.message}` : String(e)}`);
      if (e instanceof ApiError && e.code === "DIRECTION_REQUIRED") {
        // İlk okutma ama yön seçilmemiş: seçim ekranını göster, sonra yeniden okutsun.
        setNeedsDirection(true);
        setChosenDirection(null);
        setHint(e.message);
        setPhase("scan");
        return;
      }
      setError(e instanceof ApiError ? e.message : "Okutma gönderilemedi.");
      setPhase("error");
    } finally {
      busy.current = false;
    }
  };

  if (!permission) return <Screen />;
  if (!permission.granted)
    return (
      <Screen>
        <TopBar title="QR okut" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <IconCamera size={32} color={colors.brand} />
          </View>
          <Text style={[styles.title, { fontSize: 26, lineHeight: 31, marginBottom: 20 }]}>QR okutmak için kamera izni gerekiyor.</Text>
          {permission.canAskAgain ? <Button title="Kamera izni ver" onPress={requestPermission} /> : <Button title="Ayarları aç" onPress={() => Linking.openSettings()} />}
          <Button title="Geri" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
        </View>
      </Screen>
    );

  if (phase === "done" && result) {
    const isIn = result.direction === "IN";
    return (
      <Screen style={{ backgroundColor: isIn ? colors.brand : colors.exit }}>
        <StatusBar style="light" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
            <IconCheck size={64} color={isIn ? colors.brand : colors.exit} strokeWidth={3} />
          </View>
          <Text style={{ fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -0.4, color: colors.white, marginTop: 24, textAlign: "center" }}>{isIn ? "Giriş kaydedildi" : "Çıkış kaydedildi"}</Text>
          <Text style={{ fontSize: 44, fontWeight: "600", fontFamily: mono, color: colors.white, marginTop: 6 }}>{result.time}</Text>
          <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.8)" }}>Saat</Text>
        </View>
        <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 18, padding: 16, gap: 10, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <IconBluetooth size={20} color={colors.white} />
            <Text style={{ flex: 1, fontSize: 15, color: colors.white }}>
              Bluetooth doğrulaması: {result.bleVerified === null ? "sinyal yok" : result.bleVerified ? "kiosk doğrulandı ✓" : "jeton eşleşmedi ✗"}
            </Text>
          </View>
          {result.duplicate && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <IconInfo size={20} color={colors.white} />
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.white }}>Bu işlem az önce zaten kaydedilmişti; velinize tekrar SMS gönderilmedi.</Text>
            </View>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => ({ minHeight: 60, borderRadius: 16, backgroundColor: colors.white, opacity: pressed ? 0.85 : 1, alignItems: "center", justifyContent: "center" })}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: isIn ? colors.brandDark : colors.exitInk }}>Tamam</Text>
        </Pressable>
      </Screen>
    );
  }

  if (needsDirection && !chosenDirection && phase === "scan")
    return (
      <Screen>
        <TopBar title="İlk okutma" onBack={() => router.back()} />
        <Text style={[styles.title, { fontSize: 30 }]}>İlk okutmanız</Text>
        <Text style={[styles.sub, { marginBottom: 24 }]}>
          Şu an okula mı giriyorsunuz, okuldan mı çıkıyorsunuz? Bunu yalnızca bir kez seçersiniz; sonraki okutmalarda sistem sırayla giriş ve çıkış kaydeder.
        </Text>
        <DirectionCard title="Okula giriyorum" tone="in" onPress={() => setChosenDirection("IN")} />
        <DirectionCard title="Okuldan çıkıyorum" tone="out" onPress={() => setChosenDirection("OUT")} />
        <View style={{ flex: 1 }} />
        <Button title="Vazgeç" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );

  if (phase === "error")
    return (
      <Screen>
        <TopBar title="QR okut" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
            <IconX size={44} color={colors.danger} />
          </View>
          <Text style={[styles.title, { marginBottom: 16 }]}>Okutma kabul edilmedi</Text>
          <ErrorBox message={error} />
        </View>
        <Button
          title="Tekrar dene"
          onPress={() => {
            setError(null);
            setPhase("scan");
          }}
          style={{ minHeight: 60, borderRadius: 16 }}
        />
        <Button title="Geri" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
      </Screen>
    );

  const dir = chosenDirection ?? nextDirection;
  const bleDot = bleStatus === "found" ? colors.brand : bleStatus === "scanning" ? colors.warn : colors.muted;
  return (
    <Screen style={{ backgroundColor: "#0B120E" }}>
      <StatusBar style="light" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={() => router.back()} hitSlop={8} style={{ width: 48, height: 48, marginLeft: -12, alignItems: "center", justifyContent: "center" }}>
          <IconBack size={26} color={colors.white} />
        </Pressable>
        {dir && (
          <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: dir === "IN" ? colors.brand : colors.exit }}>
            <Text style={{ fontSize: 14, fontWeight: "800", letterSpacing: 0.5, color: colors.white }}>Bu okutma: {dir === "IN" ? "GİRİŞ" : "ÇIKIŞ"}</Text>
          </View>
        )}
        <View style={{ width: 36 }} />
      </View>
      <Text style={{ fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.3, color: colors.white }}>Kiosk QR kodunu okutun</Text>
      <Text style={{ fontSize: 15, lineHeight: 21, color: "rgba(255,255,255,0.72)", marginTop: 6, marginBottom: 16 }}>Kiosk ekranındaki kodu çerçevenin içine alın. Kod birkaç saniyede bir yenilenir.</Text>
      <View style={{ flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "#000" }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={phase === "scan" ? onScanned : undefined} />
        <View pointerEvents="none" style={{ position: "absolute", top: "18%", left: "14%", right: "14%", aspectRatio: 1 }}>
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <View
              key={c}
              style={{
                position: "absolute",
                width: 44,
                height: 44,
                borderColor: colors.white,
                [c[0] === "t" ? "top" : "bottom"]: 0,
                [c[1] === "l" ? "left" : "right"]: 0,
                [c[0] === "t" ? "borderTopWidth" : "borderBottomWidth"]: 5,
                [c[1] === "l" ? "borderLeftWidth" : "borderRightWidth"]: 5,
                [`border${c[0] === "t" ? "Top" : "Bottom"}${c[1] === "l" ? "Left" : "Right"}Radius`]: 18,
              }}
            />
          ))}
        </View>
        {phase === "sending" && (
          <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(11,18,14,0.65)", alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={{ color: "#fff", marginTop: 12, fontSize: 17, fontWeight: "600" }}>Doğrulanıyor…</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)" }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
          {bleStatus === "off" || bleStatus === "no-permission" || bleStatus === "unavailable" ? <IconBluetoothOff size={20} color={colors.white} /> : <IconBluetooth size={20} color={colors.white} />}
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.white }}>{bleLabel[bleStatus]}</Text>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: bleDot }} />
      </View>
      {hint && (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: colors.warnSoft }}>
          <IconAlert size={20} color={colors.warn} />
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.warnInk }}>{hint}</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => router.push("/ble-debug")} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.white }}>Bluetooth testi</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.8)" }}>Vazgeç</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// İlk okutmadaki yön seçim kartı (yalnızca görünüm).
function DirectionCard({ title, tone, onPress }: { title: string; tone: "in" | "out"; onPress: () => void }) {
  const isIn = tone === "in";
  const main = isIn ? colors.brand : colors.exit;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 20,
        minHeight: 96,
        marginBottom: 14,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: pressed ? main : colors.line,
        backgroundColor: pressed ? (isIn ? colors.brandSoft : colors.exitSoft) : colors.white,
      })}
    >
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: main, alignItems: "center", justifyContent: "center" }}>
        {isIn ? <IconIn size={30} color={colors.white} /> : <IconOut size={30} color={colors.white} />}
      </View>
      <Text style={{ flex: 1, fontSize: 21, fontWeight: "800", color: colors.ink }}>{title}</Text>
      <IconArrowRight size={22} color={main} />
    </Pressable>
  );
}
