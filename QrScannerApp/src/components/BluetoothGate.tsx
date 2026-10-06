import React, { useEffect, useState } from "react";
import { AppState, Modal, Platform, Text, View } from "react-native";
import { IconBluetoothOff } from "@/components/icons";
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
      <View style={{ flex: 1, backgroundColor: "rgba(20,33,26,0.55)", justifyContent: "flex-end", padding: 16 }}>
        <View style={{ backgroundColor: colors.white, borderRadius: 28, padding: 24, paddingTop: 28, width: "100%", maxWidth: 520, alignSelf: "center" }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, alignSelf: "center", backgroundColor: off ? colors.dangerSoft : colors.warnSoft, alignItems: "center", justifyContent: "center" }}>
            <IconBluetoothOff size={36} color={off ? colors.danger : colors.warn} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.3, color: colors.ink, textAlign: "center", marginTop: 16 }}>{off ? "Bluetooth kapalı" : "Bluetooth izni gerekli"}</Text>
          <Text style={{ fontSize: 15, color: colors.inkSoft, textAlign: "center", marginTop: 10, lineHeight: 22 }}>
            Okul kioskunun yanında olduğunuzu doğrulamak için Bluetooth açık olmalı. {steps}
          </Text>
          <Button
            title={Platform.OS === "ios" && off ? "Ayarları aç" : off ? "Bluetooth'u aç" : "İzin ver"}
            onPress={() => openBluetoothSettings(state)}
            style={{ marginTop: 22, minHeight: 60, borderRadius: 16 }}
          />
          <Button title="Şimdilik geç" variant="ghost" onPress={() => setDismissed(true)} style={{ marginTop: 6 }} />
        </View>
      </View>
    </Modal>
  );
}
