#!/usr/bin/env bash
# Veritabanının sıkıştırılmış yedeğini deploy/yedek/ klasörüne alır; 14 günden eskileri siler.
# Geri yükleme: gunzip -c yedek/fb-TARIH.sql.gz | docker compose exec -T db psql -U fb_app -d fenbahceleri
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p yedek
F="yedek/fb-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U fb_app -d fenbahceleri --clean --if-exists | gzip > "$F"
find yedek -name 'fb-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') yedek alındı: $F ($(du -h "$F" | cut -f1))"
