# AdminPanel canlı imajı (Next.js standalone). Kullanım: deploy/docker-compose.yml
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# public/ boşsa git'te yer almaz; klasör yoksa oluştur ki aşağıdaki kopyalama hata vermesin.
RUN mkdir -p public && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Şema ve yönetim betikleri (pg ve bcryptjs standalone node_modules içinde mevcut)
COPY --from=build --chown=app:app /app/db ./db
COPY --from=build --chown=app:app /app/scripts/db-setup.mjs /app/scripts/create-admin.mjs ./scripts/
# Betiklerin kendi bağımlılıkları (standalone çıktısı bcryptjs'i yalnızca derlenmiş kodun içine gömer).
RUN cd scripts && echo '{"type":"module","private":true}' > package.json \
  && npm install --omit=dev --no-audit --no-fund pg@^8.23.1 bcryptjs@^3.0.3 >/dev/null \
  && chown -R app:app /app/scripts
USER app
EXPOSE 3000
# Her açılışta şemayı uygular (tekrar çalıştırılabilir, veriye dokunmaz), sonra sunucuyu başlatır.
CMD ["sh", "-c", "node scripts/db-setup.mjs && node server.js"]
