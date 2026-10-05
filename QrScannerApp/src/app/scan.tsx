import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { Button, Card, ErrorBox, Screen } from "@/components/ui";
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
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 16, color: colors.ink }}>QR okutmak için kamera izni gerekiyor.</Text>
          {permission.canAskAgain ? <Button title="Kamera izni ver" onPress={requestPermission} /> : <Button title="Ayarları aç" onPress={() => Linking.openSettings()} />}
          <Button title="Geri" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
        </View>
      </Screen>
    );

  if (phase === "done" && result)
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Card style={{ alignItems: "center", paddingVertical: 32, backgroundColor: colors.brandSoft, borderColor: "#d5ebdd" }}>
            <Text style={{ fontSize: 48, color: colors.brand }}>✓</Text>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.brandDark, marginTop: 8 }}>{result.direction === "IN" ? "Giriş kaydedildi" : "Çıkış kaydedildi"}</Text>
            <Text style={{ fontSize: 18, color: colors.ink, marginTop: 6 }}>Saat {result.time}</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 8 }}>
              Bluetooth doğrulaması: {result.bleVerified === null ? "sinyal yok" : result.bleVerified ? "kiosk doğrulandı ✓" : "jeton eşleşmedi ✗"}
            </Text>
            {result.duplicate && <Text style={{ fontSize: 13, color: colors.muted, marginTop: 8, textAlign: "center" }}>Bu işlem az önce zaten kaydedilmişti; velinize tekrar SMS gönderilmedi.</Text>}
          </Card>
          <Button title="Tamam" onPress={() => router.back()} style={{ marginTop: 20 }} />
        </View>
      </Screen>
    );

  if (needsDirection && !chosenDirection && phase === "scan")
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.ink }}>İlk okutmanız</Text>
          <Text style={{ fontSize: 15, color: colors.muted, marginTop: 6, marginBottom: 24 }}>
            Şu an okula mı giriyorsunuz, okuldan mı çıkıyorsunuz? Bunu yalnızca bir kez seçersiniz; sonraki okutmalarda sistem sırayla giriş ve çıkış kaydeder.
          </Text>
          <Button title="Okula giriyorum" onPress={() => setChosenDirection("IN")} style={{ minHeight: 64 }} />
          <Button title="Okuldan çıkıyorum" variant="secondary" onPress={() => setChosenDirection("OUT")} style={{ minHeight: 64, marginTop: 12 }} />
          <Button title="Vazgeç" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
        </View>
      </Screen>
    );

  if (phase === "error")
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 12 }}>Okutma kabul edilmedi</Text>
          <ErrorBox message={error} />
          <Button
            title="Tekrar dene"
            onPress={() => {
              setError(null);
              setPhase("scan");
            }}
          />
          <Button title="Geri" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
        </View>
      </Screen>
    );

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink }}>Kiosk QR kodunu okutun</Text>
      {(chosenDirection ?? nextDirection) && (
        <Text style={{ fontSize: 15, fontWeight: "600", color: (chosenDirection ?? nextDirection) === "IN" ? colors.brandDark : "#0369a1", marginTop: 2 }}>
          Bu okutma: {(chosenDirection ?? nextDirection) === "IN" ? "GİRİŞ" : "ÇIKIŞ"}
        </Text>
      )}
      <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 12 }}>Kiosk ekranındaki kodu çerçevenin içine alın. Kod birkaç saniyede bir yenilenir.</Text>
      <View style={{ flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={phase === "scan" ? onScanned : undefined} />
        <View pointerEvents="none" style={{ position: "absolute", top: "20%", left: "15%", right: "15%", aspectRatio: 1, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)", borderRadius: 18 }} />
        {phase === "sending" && (
          <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={{ color: "#fff", marginTop: 12, fontSize: 16 }}>Doğrulanıyor…</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: bleStatus === "found" ? colors.brand : bleStatus === "scanning" ? "#f59e0b" : "#94a3b8" }} />
        <Text style={{ fontSize: 13, color: colors.muted }}>{bleLabel[bleStatus]}</Text>
      </View>
      {hint && <Text style={{ marginTop: 8, fontSize: 14, color: colors.warn }}>{hint}</Text>}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Button title="Bluetooth testi" variant="secondary" onPress={() => router.push("/ble-debug")} style={{ flex: 1 }} />
        <Button title="Vazgeç" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
