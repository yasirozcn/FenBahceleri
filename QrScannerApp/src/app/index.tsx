import { Redirect, router } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
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
        <Text style={{ fontSize: 13, fontWeight: "700", letterSpacing: 1.2, color: colors.brand, textTransform: "uppercase" }}>Fen Bahçeleri</Text>
        <Text style={[styles.title, { fontSize: 30, marginTop: 6 }]}>Okul Giriş-Çıkış</Text>
        <Text style={[styles.sub, { marginBottom: 36 }]}>Okula girişte ve çıkışta kiosk ekranındaki QR kodu bu uygulamayla okutun.</Text>

        <Button title="Öğrenci girişi" onPress={() => router.push("/student-login")} />
        <Button title="Yönetici girişi (kiosk)" variant="secondary" style={{ marginTop: 12 }} onPress={() => router.push("/admin-login")} />
        <Button title="Bluetooth testi" variant="ghost" style={{ marginTop: 12 }} onPress={() => router.push("/ble-debug")} />
      </View>
      <Text style={{ textAlign: "center", color: "#94a3b8", fontSize: 11 }}>Sunucu: {API_URL}</Text>
    </Screen>
  );
}
