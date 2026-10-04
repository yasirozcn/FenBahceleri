#!/usr/bin/env bash
# Android kiosk APK'sını derler; telefon USB hata ayıklamayla bağlıysa kurar.
# Sunucu adresi .env'deki EXPO_PUBLIC_API_URL'den alınır ve APK'nın içine gömülür.
# Gerekenler: Android Studio (SDK + NDK 27.1) ve JAVA_HOME = Java 17 (Java 25 derlemeyi bozar).
# Kullanım: bash tools/android-apk.sh
set -euo pipefail
cd "$(dirname "$0")/.."
API_URL=$(grep -E '^EXPO_PUBLIC_API_URL=' .env | cut -d= -f2-)
echo "Sunucu adresi: $API_URL"
java -version 2>&1 | grep -q '"17' || echo "UYARI: Java 17 değil ($(java -version 2>&1 | head -1)). Derleme hata verirse JAVA_HOME'u Java 17 yapın."
NODE_OPTIONS=--use-system-ca CI=1 npx expo prebuild -p android --clean >/dev/null
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a -q)
APK=android/app/build/outputs/apk/release/app-release.apk
cp "$APK" ./fen-bahceleri-kiosk.apk
echo "APK: $(pwd)/fen-bahceleri-kiosk.apk"
if command -v adb >/dev/null && adb devices | grep -qw device; then
  adb install -r ./fen-bahceleri-kiosk.apk && echo "Telefona kuruldu."
else
  echo "Bağlı Android telefon yok; APK'yı telefona gönderip açarak kurun."
fi
