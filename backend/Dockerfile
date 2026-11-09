# =============================================================
# Image Backend SouverainRecrut
#  - build multi-étapes : seules les dépendances de production
#    et le code compilé sont embarqués
#  - Node.js 22 LTS (exigence : Node 22+)
#  - exécution en utilisateur non-root + healthcheck
#
# Build : docker build -t souverainrecrut-backend:<version> backend/
# =============================================================
ARG NODE_IMAGE=node:22-alpine3.24

# -------------------------------------------------------------
# Étape 1 : build (dépendances complètes, client Prisma, tsc)
# -------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

# Prisma (moteur de requêtes musl) a besoin d'OpenSSL
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN npx prisma generate

COPY src ./src
RUN npm run build

# -------------------------------------------------------------
# Étape 2 : production
# -------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner

ARG APP_VERSION=dev
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="souverainrecrut-backend" \
      org.opencontainers.image.description="API REST SouverainRecrut (Express, TypeScript, Prisma)" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

RUN apk add --no-cache openssl \
 && apk upgrade --no-cache

ENV NODE_ENV=production \
    PORT=4000 \
    API_VERSION=v1

# Dépendances de production uniquement (bcrypt compilé via ses scripts)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 && npm cache clean --force

# Code compilé, schéma/migrations Prisma et client Prisma généré
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Utilisateur non-root fourni par l'image node
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/${API_VERSION}/health" > /dev/null || exit 1

CMD ["node", "dist/server.js"]
