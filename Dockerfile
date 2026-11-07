# syntax=docker/dockerfile:1

# ---------- Compilation du site ----------
# Images de base épinglées par empreinte (digest) : une image amont modifiée ne peut pas
# entrer en production sans passer par une PR Dependabot et la CI.
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx tsx scripts/gen-redirects.ts && npx astro build

# ---------- Service : nginx non privilégié ----------
# Branche stable de nginx (1.30.x), variante « slim » : sans modules ni bibliothèques inutiles.
FROM nginxinc/nginx-unprivileged:stable-alpine-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6
LABEL org.opencontainers.image.title="La Traction de Provence" \
      org.opencontainers.image.description="Site du club La Traction de Provence" \
      org.opencontainers.image.source="https://github.com/Vh4ld/la-traction-de-provence" \
      org.opencontainers.image.licenses="MIT"
# Pas de gestionnaire de paquets dans l'image finale.
USER root
RUN rm -rf /sbin/apk /etc/apk /lib/apk /usr/share/apk /var/cache/apk
# Utilisateur non privilégié (nginx, UID 101), explicite même si l'image de base change.
USER 101

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/deploy/redirects /etc/nginx/redirects
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
