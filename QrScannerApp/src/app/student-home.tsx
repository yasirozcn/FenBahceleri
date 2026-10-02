import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { Button, Card, ErrorBox, Screen } from "@/components/ui";
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
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
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
            <Text style={{ fontSize: 14, color: colors.muted }}>Merhaba</Text>
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.ink }}>
              {data.student.firstName} {data.student.lastName}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>{data.student.className}</Text>

            <Card style={{ backgroundColor: inside ? colors.brandSoft : colors.white, borderColor: inside ? "#d5ebdd" : colors.line, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>Şu anki durum</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: inside ? colors.brandDark : colors.ink, marginTop: 2 }}>{inside ? "Okuldasınız" : "Okul dışındasınız"}</Text>
            </Card>

            <Button title={inside ? "Çıkış için QR okut" : "Giriş için QR okut"} onPress={() => router.push("/scan")} style={{ minHeight: 64 }} />

            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 28, marginBottom: 10 }}>Son hareketler</Text>
            {data.events.length === 0 && <Text style={{ color: colors.muted }}>Henüz kayıt yok.</Text>}
            {data.events.map((e) => (
              <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: e.direction === "IN" ? colors.brandDark : "#0369a1" }}>{e.direction === "IN" ? "Giriş" : "Çıkış"}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{e.kioskName ?? "Manuel kayıt"}</Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.ink }}>{fmt(e.occurredAt)}</Text>
              </View>
            ))}

            <Button title="Çıkış yap" variant="ghost" onPress={logout} style={{ marginTop: 24 }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
