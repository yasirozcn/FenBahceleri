import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json'daki ayarlar + derleme anında belirlenenler.
// Sunucu adresi http:// ise (yerel ağdaki test sunucusu) Android'in düz HTTP engeli bu derleme için kaldırılır.
// Canlı/TestFlight derlemelerinde adres https:// olduğu için engel açık kalır.
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  const allowHttp = apiUrl.startsWith("http://");
  return {
    ...(config as ExpoConfig),
    plugins: [...(config.plugins ?? []), ["expo-build-properties", { android: { usesCleartextTraffic: allowHttp } }]],
  };
};
