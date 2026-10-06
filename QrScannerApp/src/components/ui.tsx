import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/lib/config";
import { IconBack } from "./icons";

/** Saat ve kod gibi sayılar için eş aralıklı yazı tipi (sistem fontu). */
export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function Screen({ children, style, padded = true }: { children?: React.ReactNode; style?: ViewStyle; padded?: boolean }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={["top", "bottom", "left", "right"]}>
      <View style={[{ flex: 1 }, padded && { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 }]}>{children}</View>
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 24 }}>
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
      style={({ pressed }) => [
        styles.btn,
        v.box,
        (disabled || loading) && { opacity: 0.45 },
        pressed && (variant === "primary" ? { backgroundColor: colors.brandDark } : { opacity: 0.75 }),
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={[styles.btnText, v.text]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocus, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <View style={[styles.boxDot, { backgroundColor: colors.danger }]}>
        <Text style={styles.boxDotText}>!</Text>
      </View>
      <Text style={{ flex: 1, color: colors.dangerInk, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>{message}</Text>
    </View>
  );
}

export function InfoBox({ message, tone = "info" }: { message: string; tone?: "info" | "warn" }) {
  const warn = tone === "warn";
  return (
    <View style={[styles.infoBox, warn && { backgroundColor: colors.warnSoft }]}>
      <View style={[styles.boxDot, { backgroundColor: warn ? colors.warn : colors.brand }]}>
        <Text style={styles.boxDotText}>{warn ? "!" : "i"}</Text>
      </View>
      <Text style={{ flex: 1, color: warn ? colors.warnInk : colors.brandDark, fontSize: 14, lineHeight: 20 }}>{message}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Ekran üstü: geri oku + ortada küçük başlık (tasarımdaki gezinme çubuğu). */
export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: colors.lineSoft }]}>
          <IconBack size={26} />
        </Pressable>
      ) : (
        <View style={{ width: 48 }} />
      )}
      {title ? <Text style={styles.topBarTitle}>{title}</Text> : <View />}
      <View style={{ minWidth: 48, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

/** Durum etiketi (Okulda / Dışarıda gibi). */
export function Pill({ label, tone = "neutral" }: { label: string; tone?: "brand" | "neutral" | "exit" | "warn" | "danger" }) {
  const t = pillTones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: t.dot }]} />
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const pillTones = {
  brand: { bg: colors.brandSoft, fg: colors.brandDark, dot: colors.brand },
  neutral: { bg: colors.lineSoft, fg: colors.inkSoft, dot: colors.muted },
  exit: { bg: colors.exitSoft, fg: colors.exitInk, dot: colors.exit },
  warn: { bg: colors.warnSoft, fg: colors.warnInk, dot: colors.warn },
  danger: { bg: colors.dangerSoft, fg: colors.dangerInk, dot: colors.danger },
};

const variants = {
  primary: { box: { backgroundColor: colors.brand }, text: { color: colors.white } },
  secondary: { box: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lineStrong }, text: { color: colors.ink } },
  danger: { box: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.dangerLine }, text: { color: colors.danger } },
  ghost: { box: { backgroundColor: "transparent" }, text: { color: colors.inkSoft } },
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.4, color: colors.ink },
  sub: { marginTop: 8, fontSize: 16, color: colors.inkSoft, lineHeight: 23 },
  btn: { minHeight: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnText: { fontSize: 17, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.ink,
  },
  inputFocus: { borderWidth: 2, borderColor: colors.brand },
  fieldError: { marginTop: 6, fontSize: 13, fontWeight: "600", color: colors.danger },
  errorBox: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14, marginBottom: 16 },
  infoBox: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: colors.brandSoft, borderRadius: 14, padding: 14, marginBottom: 16 },
  boxDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: -1 },
  boxDotText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, marginBottom: 20 },
  backBtn: { width: 48, height: 48, marginLeft: -12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 15, fontWeight: "700", color: colors.inkSoft },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: "700" },
  card: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 20 },
});
