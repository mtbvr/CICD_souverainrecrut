# =============================================================
# Image Jenkins du lab SouverainRecrut
#  - Jenkins LTS (JDK 21)
#  - Node.js 22 (tests, Prisma, build TypeScript)
#  - Docker CLI + buildx (build de l'image, Trivy via conteneur)
#  - Plugins préinstallés (plugins.txt)
# =============================================================
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS node

FROM jenkins/jenkins:lts-jdk21

USER root

# --- Node.js 22, copié depuis l'image officielle ---------------
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# --- Docker CLI (dépôt officiel Docker) ------------------------
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg openssl \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && chmod a+r /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin \
 && rm -rf /var/lib/apt/lists/*

USER jenkins

# --- Plugins ---------------------------------------------------
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
