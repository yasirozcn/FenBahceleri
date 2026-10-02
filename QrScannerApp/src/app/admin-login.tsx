import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Button, ErrorBox, Field, InfoBox, Screen, Title } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";

// Uygulama içi yönetici girişi: yalnızca kiosk (QR gösterme) ekranını açar.
// Hesaplar AdminPanel veritabanındaki yönetici kullanıcılardır (admin_users).
export default function AdminLogin() {
  const { setAdminSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ token: string }>("/api/mobile/admin/login", { method: "POST", body: { email: email.trim(), password } });
      await setAdminSession(r.token);
      router.replace("/kiosk-select");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Giriş yapılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          <Title sub="Bu giriş, cihazı kapıdaki QR ekranına (kiosk) dönüştürür.">Yönetici girişi</Title>
          <InfoBox message="Kiosk için Android tablet önerilir: Bluetooth yakınlık doğrulaması yalnızca Android'de yayınlanabilir." />
          <Field label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" />
          <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" onSubmitEditing={submit} />
          <ErrorBox message={error} />
          <Button title="Giriş yap" onPress={submit} loading={loading} />
          <Button title="Geri" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
