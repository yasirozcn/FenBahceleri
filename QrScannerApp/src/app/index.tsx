import { Redirect, router } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { IconBluetooth, IconQr } from "@/components/icons";
import { Button, Screen, styles } from "@/components/ui";
import { API_URL, colors } from "@/lib/config";
import { useSession } from "@/lib/session";

// Açılış: oturum varsa ilgili ekrana, yoksa "Öğrenci girişi / Yönetici girişi" seçimine.
export default function Home() {
  const { ready, studentToken, adminToken } = useSession();

  if (!ready)
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  if (adminToken) return <Redirect href="/kiosk-select" />;
  if (studentToken) return <Redirect href="/student-home" />;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.white, fontSize: 19, fontWeight: "800" }}>FB</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "700", letterSpacing: 1.4, color: colors.brand, textTransform: "uppercase" }}>Fen Bahçeleri</Text>
        </View>
        <Text style={[styles.title, { fontSize: 36, lineHeight: 40 }]}>Okul Giriş-Çıkış</Text>
        <Text style={[styles.sub, { fontSize: 17, lineHeight: 25, marginBottom: 32 }]}>Okula girişte ve çıkışta kiosk ekranındaki QR kodu bu uygulamayla okutun.</Text>

        <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, gap: 16, marginBottom: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <IconQr size={22} color={colors.brand} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink }}>Kapıdaki kodu okutun</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <IconBluetooth size={22} color={colors.brand} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink }}>Bluetooth açık olsun</Text>
          </View>
        </View>

        <Button title="Öğrenci girişi" onPress={() => router.push("/student-login")} />
        <Button title="Yönetici girişi (kiosk)" variant="secondary" style={{ marginTop: 12 }} onPress={() => router.push("/admin-login")} />
        <Button title="Bluetooth testi" variant="ghost" style={{ marginTop: 8 }} onPress={() => router.push("/ble-debug")} />
      </View>
      <Text style={{ textAlign: "center", color: colors.muted, fontSize: 11 }}>Sunucu: {API_URL}</Text>
    </Screen>
  );
}
