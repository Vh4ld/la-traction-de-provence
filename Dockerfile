# syntax=docker/dockerfile:1

# ---------- Compilation du site ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx tsx scripts/gen-redirects.ts && npx astro build

# ---------- Service : nginx non privilégié ----------
FROM nginxinc/nginx-unprivileged:alpine
LABEL org.opencontainers.image.title="La Traction de Provence" \
      org.opencontainers.image.description="Site du club La Traction de Provence" \
      org.opencontainers.image.source="https://github.com/Vh4ld/la-traction-de-provence" \
      org.opencontainers.image.licenses="MIT"
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/deploy/redirects /etc/nginx/redirects
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
