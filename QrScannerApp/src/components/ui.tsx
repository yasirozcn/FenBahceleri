import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/lib/config";

export function Screen({ children, style, padded = true }: { children?: React.ReactNode; style?: ViewStyle; padded?: boolean }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={["top", "bottom", "left", "right"]}>
      <View style={[{ flex: 1 }, padded && { padding: 20 }]}>{children}</View>
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, v.box, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={[styles.btnText, v.text]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#94a3b8" style={[styles.input, error ? { borderColor: colors.danger } : null]} {...props} />
    </View>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={{ color: colors.danger, fontSize: 14 }}>{message}</Text>
    </View>
  );
}

export function InfoBox({ message, tone = "info" }: { message: string; tone?: "info" | "warn" }) {
  return (
    <View style={[styles.infoBox, tone === "warn" && { backgroundColor: colors.warnSoft, borderColor: "#fde68a" }]}>
      <Text style={{ color: tone === "warn" ? colors.warn : colors.brandDark, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const variants = {
  primary: { box: { backgroundColor: colors.brand }, text: { color: colors.white } },
  secondary: { box: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, text: { color: colors.ink } },
  danger: { box: { backgroundColor: colors.white, borderWidth: 1, borderColor: "#fecaca" }, text: { color: colors.danger } },
  ghost: { box: { backgroundColor: "transparent" }, text: { color: colors.muted } },
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink },
  sub: { marginTop: 6, fontSize: 15, color: colors.muted, lineHeight: 21 },
  btn: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnText: { fontSize: 16, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  errorBox: { backgroundColor: colors.dangerSoft, borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
  infoBox: { backgroundColor: colors.brandSoft, borderColor: "#d5ebdd", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
  card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 16 },
});
