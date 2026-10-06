import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { IconArrowRight, IconBluetooth, IconQr } from "@/components/icons";
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.white, fontSize: 17, fontWeight: "800" }}>FB</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink }}>Kapı Tableti</Text>
        <Button
          title="Yönetici oturumunu kapat"
          variant="danger"
          style={{ minHeight: 44, borderRadius: 12, paddingHorizontal: 14 }}
          onPress={async () => {
            await clearAdminSession();
            router.replace("/");
          }}
        />
      </View>
      <Title sub="Bu tabletin duracağı kapıyı seçin. Ekran QR moduna geçer ve kapanmaz.">Kiosk seçin</Title>
      <ErrorBox message={error} />
      {!kiosks && !error && <ActivityIndicator color={colors.brand} />}
      <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {kiosks?.map((k) => (
          <Pressable
            key={k.id}
            onPress={() => router.push({ pathname: "/kiosk/[id]", params: { id: k.id } })}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 260,
              minHeight: 190,
              backgroundColor: pressed ? colors.brandSoft : colors.white,
              borderWidth: pressed ? 2 : 1,
              borderColor: pressed ? colors.brand : colors.line,
              borderRadius: 22,
              padding: 22,
              gap: 18,
            })}
          >
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <IconQr size={30} color={colors.brand} />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink }}>{k.name}</Text>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.inkSoft }}>Giriş · çıkış kiosku</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.brand }}>QR ekranını aç</Text>
              <IconArrowRight size={18} color={colors.brand} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }}>
        <IconBluetooth size={22} color={colors.brand} />
        <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>Kiosk QR ile birlikte Bluetooth sinyali yayınlar. Tableti şarja takılı ve Bluetooth açık bırakın.</Text>
        <Button title="Bluetooth testi" variant="secondary" onPress={() => router.push("/ble-debug")} style={{ minHeight: 44, borderRadius: 12 }} />
      </View>
    </Screen>
  );
}
