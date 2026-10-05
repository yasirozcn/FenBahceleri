#!/usr/bin/env bash
# iPhone'a bağımsız (Release) sürümü derleyip kurar. Telefon kabloyla bağlı ve kilidi açık olmalı.
# Sunucu adresi .env'deki EXPO_PUBLIC_API_URL'den alınır ve uygulamanın içine gömülür.
# Kullanım: TEAM_ID=XXXXXXXXXX bash tools/ios-kur.sh
#   TEAM_ID: Apple geliştirici takım kimliği (developer.apple.com → Membership details → Team ID).
#   Kalıcı yapmak için .env dosyasına IOS_TEAM_ID=XXXXXXXXXX ekleyin (git'e girmez).
set -euo pipefail
cd "$(dirname "$0")/.."
TEAM_ID="${TEAM_ID:-$(grep -E '^IOS_TEAM_ID=' .env 2>/dev/null | cut -d= -f2-)}"
[ -n "$TEAM_ID" ] || { echo "TEAM_ID gerekli: TEAM_ID=XXXXXXXXXX bash tools/ios-kur.sh  (veya .env içine IOS_TEAM_ID=...)"; exit 1; }
API_URL=$(grep -E '^EXPO_PUBLIC_API_URL=' .env | cut -d= -f2-)
echo "Sunucu adresi: $API_URL"

DEVICE=$(xcrun devicectl list devices 2>/dev/null | awk '/physical/ && !/unavailable/ { for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) print $i }' | head -1)
[ -n "$DEVICE" ] || { echo "Bağlı iPhone bulunamadı (kablo, kilit, 'Bu bilgisayara güven' ve Geliştirici Modu'nu kontrol edin)."; exit 1; }
echo "Cihaz: $DEVICE"

NODE_OPTIONS=--use-system-ca CI=1 npx expo prebuild -p ios --clean >/dev/null
DD="${TMPDIR:-/tmp}/fb-ios-build"
xcodebuild -workspace ios/*.xcworkspace -scheme "$(basename ios/*.xcworkspace .xcworkspace)" -configuration Release \
  -destination "id=$DEVICE" -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic -derivedDataPath "$DD" build -quiet
APP=$(ls -d "$DD"/Build/Products/Release-iphoneos/*.app | head -1)
xcrun devicectl device install app --device "$DEVICE" "$APP" >/dev/null
rm -rf "$DD"
echo "Kuruldu: $(basename "$APP") → iPhone ($API_URL)"
