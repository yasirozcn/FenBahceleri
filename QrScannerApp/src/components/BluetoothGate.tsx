import React, { useEffect, useState } from "react";
import { AppState, Modal, Platform, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { openBluetoothSettings, subscribeBtState, type BtState } from "@/lib/ble";
import { colors } from "@/lib/config";

// Uygulama açıkken Bluetooth kapalıysa veya izin verilmemişse kullanıcıyı açmaya yönlendirir.
// Kiosk yakınlık doğrulaması Bluetooth ile yapılır; kapalıyken okutmalar BLE'siz gider (BLE_REQUIRED=true ise reddedilir).
export function BluetoothGate() {
  const [state, setState] = useState<BtState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeBtState((s) => {
    setState(s);
    if (s === "PoweredOn") setDismissed(false);
  }), []);

  // "Şimdilik geç" denmişse uygulama tekrar öne geldiğinde yeniden sor.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && setDismissed(false));
    return () => sub.remove();
  }, []);

  const problem = state === "PoweredOff" || state === "Unauthorized";
  if (!problem || dismissed) return null;

  const off = state === "PoweredOff";
  const steps =
    Platform.OS === "ios"
      ? off
        ? "Ekranın sağ üst köşesinden aşağı kaydırıp Denetim Merkezi'ni açın ve Bluetooth simgesine dokunun. Ya da Ayarlar → Bluetooth'tan açın."
        : "Ayarlar'da bu uygulamanın sayfasında Bluetooth iznini açın."
      : off
        ? "Aşağıdaki düğmeyle Bluetooth'u açın."
        : "Ayarlar'da bu uygulamanın izinlerinden \"Yakındaki cihazlar\" iznini verin.";

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setDismissed(true)}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 22 }}>
          <Text style={{ fontSize: 36, textAlign: "center" }}>📶</Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.ink, textAlign: "center", marginTop: 6 }}>{off ? "Bluetooth kapalı" : "Bluetooth izni gerekli"}</Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
            Okul kioskunun yanında olduğunuzu doğrulamak için Bluetooth açık olmalı. {steps}
          </Text>
          <Button
            title={Platform.OS === "ios" && off ? "Ayarları aç" : off ? "Bluetooth'u aç" : "İzin ver"}
            onPress={() => openBluetoothSettings(state)}
            style={{ marginTop: 18 }}
          />
          <Button title="Şimdilik geç" variant="ghost" onPress={() => setDismissed(true)} style={{ marginTop: 6 }} />
        </View>
      </View>
    </Modal>
  );
}
