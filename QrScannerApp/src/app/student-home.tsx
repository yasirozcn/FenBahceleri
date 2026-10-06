import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { IconIn, IconLogout, IconOut, IconQr } from "@/components/icons";
import { Card, ErrorBox, mono, Pill, Screen } from "@/components/ui";
import { api, ApiError, type MeResponse } from "@/lib/api";
import { colors } from "@/lib/config";
import { clearBinding } from "@/lib/device";
import { useSession } from "@/lib/session";

const fmt = (iso: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function StudentHome() {
  const { studentToken, clearStudentSession } = useSession();
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!studentToken) return;
    try {
      const r = await api<MeResponse>("/api/mobile/student/me", { token: studentToken });
      setData(r);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === "DEVICE_REVOKED") {
        await clearBinding();
        await clearStudentSession();
        Alert.alert("Cihaz bağlantısı kaldırıldı", "Okul yönetimi bu telefonun bağlantısını kaldırdı. E-postanızla giriş yapıp yeni şifre oluşturabilirsiniz.");
        router.replace("/");
        return;
      }
      if (e instanceof ApiError && e.status === 401) {
        await clearStudentSession();
        router.replace("/student-login");
        return;
      }
      setError(e instanceof ApiError ? e.message : "Bilgiler yüklenemedi.");
    }
  }, [studentToken, clearStudentSession]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const logout = () =>
    Alert.alert("Çıkış yap", "Uygulamadan çıkış yapılsın mı? Tekrar girişte şifreniz sorulur.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış yap",
        style: "destructive",
        onPress: async () => {
          await clearStudentSession();
          router.replace("/");
        },
      },
    ]);

  const inside = data?.student.presenceStatus === "IN";

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {!data && !error && <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />}
        <ErrorBox message={error} />
        {data && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: colors.inkSoft }}>Merhaba</Text>
                <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.3, color: colors.ink }}>
                  {data.student.firstName} {data.student.lastName}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={logout}
                style={({ pressed }) => ({ height: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.lineSoft : colors.white, flexDirection: "row", alignItems: "center", gap: 6 })}
              >
                <IconLogout size={18} color={colors.inkSoft} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.inkSoft }}>Çıkış yap</Text>
              </Pressable>
            </View>

            <Card style={{ borderRadius: 22, backgroundColor: inside ? colors.brandSoft : colors.white, borderColor: inside ? colors.brandSoft : colors.line, marginBottom: 22, gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Pill label={inside ? "Okulda" : "Dışarıda"} tone={inside ? "brand" : "neutral"} />
                <Text style={{ fontSize: 13, color: colors.inkSoft }}>{data.student.className}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 13, color: colors.inkSoft }}>Şu anki durum</Text>
                <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: "800", letterSpacing: -0.3, color: inside ? colors.brandDark : colors.ink, marginTop: 2 }}>{inside ? "Okuldasınız" : "Okul dışındasınız"}</Text>
              </View>
            </Card>

            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.ink, marginBottom: 8 }}>Son hareketler</Text>
            <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 22 }}>
              {data.events.length === 0 && <Text style={{ color: colors.inkSoft, paddingVertical: 14 }}>Henüz kayıt yok.</Text>}
              {data.events.map((e, i) => {
                const isIn = e.direction === "IN";
                return (
                  <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: i === data.events.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isIn ? colors.brandSoft : colors.exitSoft, alignItems: "center", justifyContent: "center" }}>
                      {isIn ? <IconIn size={20} color={colors.brand} /> : <IconOut size={20} color={colors.exit} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink }}>{isIn ? "Giriş" : "Çıkış"}</Text>
                      <Text style={{ fontSize: 13, color: colors.inkSoft }}>{e.kioskName ?? "Manuel kayıt"}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "600", fontFamily: mono, color: colors.ink }}>{fmt(e.occurredAt)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
      {data && (
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/scan")}
            style={({ pressed }) => ({ height: 72, borderRadius: 20, backgroundColor: pressed ? colors.brandDark : colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 })}
          >
            <IconQr size={28} color={colors.white} />
            <View>
              <Text style={{ fontSize: 19, fontWeight: "700", color: colors.white }}>{data.needsDirection ? "QR okut" : inside ? "Çıkış için QR okut" : "Giriş için QR okut"}</Text>
              <Text style={{ fontSize: 13, color: "#CFE4D6" }}>Kapıdaki ekrana yaklaşın</Text>
            </View>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
