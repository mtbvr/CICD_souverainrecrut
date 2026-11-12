#!/usr/bin/env bash
# =============================================================
# Déploie une version de l'API (tag d'image Docker Hub).
#
#   1. valide le tag (<version>-<commit>)
#   2. renseigne BACKEND_TAG dans .env
#   3. tire l'image (aucune reconstruction) et démarre la stack :
#      db -> migrate (prisma migrate deploy) -> api
#   4. attend que l'API soit "healthy" puis lance les tests de fumée
#   5. en cas d'échec : retour automatique à la dernière version saine
#
# Historique : releases.log  (date  tag  statut  version_précédente)
#
# Usage : ./scripts/deploy.sh <tag>      ex. ./scripts/deploy.sh 1.0.0-172892d
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

TAG="${1:-}"
TAG_REGEX='^[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]{7}$'
HISTORY="releases.log"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
STATUS_LABEL="${DEPLOY_STATUS_LABEL:-SUCCESS}"

if [[ ! "$TAG" =~ $TAG_REGEX ]]; then
  echo "Tag invalide : '${TAG}' (attendu : <version>-<commit>, ex. 1.0.0-172892d)" >&2
  exit 1
fi
[[ -f .env ]] || { echo "Fichier .env absent dans $(pwd)" >&2; exit 1; }

# Dernière version saine (déployée avec succès ou restaurée)
current_healthy_tag() {
  [[ -f "$HISTORY" ]] || return 0
  awk '$3 == "SUCCESS" || $3 == "ROLLBACK" { tag = $2 } END { print tag }' "$HISTORY"
}

set_tag() {
  if grep -q '^BACKEND_TAG=' .env; then
    sed -i "s/^BACKEND_TAG=.*/BACKEND_TAG=$1/" .env
  else
    echo "BACKEND_TAG=$1" >> .env
  fi
}

record() {
  printf '%s %s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "${3:--}" >> "$HISTORY"
}

start_stack() {
  docker compose pull --quiet migrate api
  docker compose up -d --remove-orphans
}

wait_healthy() {
  local cid status elapsed=0
  cid="$(docker compose ps -q api)"
  [[ -n "$cid" ]] || return 1
  while (( elapsed < HEALTH_TIMEOUT )); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo unknown)"
    echo "  api : ${status} (${elapsed}s)"
    [[ "$status" == "healthy" ]] && return 0
    sleep 5
    elapsed=$(( elapsed + 5 ))
  done
  return 1
}

PREVIOUS="$(current_healthy_tag)"
echo "==> Déploiement de ${TAG} (version saine actuelle : ${PREVIOUS:-aucune})"

set_tag "$TAG"
if start_stack && wait_healthy && ./scripts/smoke-test.sh; then
  record "$TAG" "$STATUS_LABEL" "$PREVIOUS"
  docker image prune -f > /dev/null          # images orphelines uniquement
  echo "==> ${TAG} déployé avec succès"
  docker compose ps
  exit 0
fi

echo "==> ÉCHEC du déploiement de ${TAG}" >&2
record "$TAG" "FAILED" "$PREVIOUS"
docker compose logs --tail 40 migrate api || true

if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$TAG" ]]; then
  echo "==> Retour automatique à ${PREVIOUS}" >&2
  set_tag "$PREVIOUS"
  if start_stack && wait_healthy; then
    record "$PREVIOUS" "ROLLBACK" "$TAG"
    echo "==> ${PREVIOUS} restauré" >&2
  else
    echo "==> Le retour automatique a lui aussi échoué : intervention manuelle requise" >&2
  fi
fi
exit 1
