import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Button, ErrorBox, Screen, Title } from "@/components/ui";
import { api, ApiError, type KioskInfo } from "@/lib/api";
import { colors } from "@/lib/config";
import { useSession } from "@/lib/session";

export default function KioskSelect() {
  const { adminToken, clearAdminSession } = useSession();
  const [kiosks, setKiosks] = useState<KioskInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ kiosks: KioskInfo[] }>("/api/mobile/kiosks", { token: adminToken });
        setKiosks(r.kiosks);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await clearAdminSession();
          router.replace("/admin-login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Kiosklar yüklenemedi.");
      }
    })();
  }, [adminToken, clearAdminSession]);

  return (
    <Screen>
      <Title sub="Bu tabletin duracağı kapıyı seçin. Ekran QR moduna geçer ve kapanmaz.">Kiosk seçin</Title>
      <ErrorBox message={error} />
      {!kiosks && !error && <ActivityIndicator color={colors.brand} />}
      <View style={{ gap: 12 }}>
        {kiosks?.map((k) => (
          <Pressable
            key={k.id}
            onPress={() => router.push({ pathname: "/kiosk/[id]", params: { id: k.id } })}
            style={({ pressed }) => ({ backgroundColor: pressed ? colors.brandSoft : colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 18 })}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>{k.name}</Text>
            <Text style={{ fontSize: 14, color: colors.brand, marginTop: 2 }}>Giriş · çıkış kiosku</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Button title="Bluetooth testi" variant="ghost" onPress={() => router.push("/ble-debug")} style={{ marginBottom: 8 }} />
      <Button
        title="Yönetici oturumunu kapat"
        variant="danger"
        onPress={async () => {
          await clearAdminSession();
          router.replace("/");
        }}
      />
    </Screen>
  );
}
