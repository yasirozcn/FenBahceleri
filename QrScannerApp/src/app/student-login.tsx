import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { Button, ErrorBox, Field, InfoBox, Screen, Title } from "@/components/ui";
import { api, ApiError, type AuthResponse } from "@/lib/api";
import { getDeviceIdentity } from "@/lib/device";
import { useSession } from "@/lib/session";

type Step = "email" | "create-password" | "password";

// Öğrenci girişi. Kayıt ol yoktur: e-posta okul veritabanında olmalıdır.
// İlk giriş: e-posta → şifre oluştur (bu telefon hesaba bağlanır; başka telefondan giriş yapılamaz).
// Sonraki girişler: e-posta → şifre. Şifre sıfırlama yalnızca yönetici panelinden yapılır.
export default function StudentLogin() {
  const { setStudentSession } = useSession();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = () =>
    run(async () => {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes("@")) throw new ApiError(400, "Geçerli bir e-posta girin.", "BAD_EMAIL");
      // "Bu telefon başka hesaba bağlı" kararını yalnızca sunucu verir (check-email → DEVICE_TAKEN).
      const { deviceId } = await getDeviceIdentity();
      const r = await api<{ next: "create-password" | "password"; firstName: string }>("/api/mobile/student/check-email", { method: "POST", body: { email: normalized, deviceId } });
      setFirstName(r.firstName);
      setPassword("");
      setPassword2("");
      setStep(r.next);
    });

  const finish = async (r: AuthResponse) => {
    await setStudentSession(r.token, r.student);
    router.replace("/student-home");
  };

  const submitCreatePassword = () =>
    run(async () => {
      if (password.length < 8) throw new ApiError(400, "Şifre en az 8 karakter olmalı.", "WEAK");
      if (password !== password2) throw new ApiError(400, "Şifreler eşleşmiyor.", "MISMATCH");
      const { deviceId, deviceSecret } = await getDeviceIdentity();
      const r = await api<AuthResponse>("/api/mobile/student/set-password", {
        method: "POST",
        body: { email: email.trim(), password, deviceId, deviceSecret, platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown" },
      });
      await finish(r);
    });

  const submitPassword = () =>
    run(async () => {
      const { deviceId } = await getDeviceIdentity();
      const r = await api<AuthResponse>("/api/mobile/student/login", { method: "POST", body: { email: email.trim(), password, deviceId } });
      await finish(r);
    });

  const back = () => {
    setError(null);
    if (step === "email") router.back();
    else {
      setStep("email");
      setPassword("");
      setPassword2("");
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          {step === "email" && (
            <>
              <Title sub="Okulun sisteme kaydettiği e-posta adresinizi girin.">Öğrenci girişi</Title>
              <Field label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={submitEmail} />
              <ErrorBox message={error} />
              <Button title="Devam" onPress={submitEmail} loading={loading} />
            </>
          )}

          {step === "create-password" && (
            <>
              <Title sub={`Merhaba ${firstName}. Bundan sonraki girişlerde bu şifreyi kullanacaksınız.`}>Şifre oluşturun</Title>
              <InfoBox message="Şifrenizi kaydettiğinizde hesabınız bu telefona bağlanır. Başka bir telefondan giriş yapmak için okul yönetiminin cihazınızı sıfırlaması gerekir." />
              <Field label="Şifre (en az 8 karakter)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
              <Field label="Şifre (tekrar)" value={password2} onChangeText={setPassword2} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submitCreatePassword} />
              <ErrorBox message={error} />
              <Button title="Şifreyi kaydet ve giriş yap" onPress={submitCreatePassword} loading={loading} />
            </>
          )}

          {step === "password" && (
            <>
              <Title sub={`Merhaba ${firstName}. Şifrenizi girin.`}>Şifre</Title>
              <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submitPassword} />
              <ErrorBox message={error} />
              <Button title="Giriş yap" onPress={submitPassword} loading={loading} />
              <Text style={{ marginTop: 14, fontSize: 13, color: "#64748b", textAlign: "center" }}>Şifrenizi unuttuysanız okul yönetiminden şifre sıfırlaması isteyin.</Text>
            </>
          )}

          <Button title="Geri" variant="ghost" onPress={back} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
