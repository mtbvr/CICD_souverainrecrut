#!/usr/bin/env bash
# =============================================================
# Démarrage du lab : Jenkins + SonarQube + PostgreSQL
#   - crée .env au premier lancement (GID docker, mot de passe aléatoire)
#   - construit l'image Jenkins et démarre la stack
#
# Usage : ./scripts/start-lab.sh          (VM locale : ports ouverts sur le réseau)
#         ./scripts/start-lab.sh --vps    (VPS : ports liés à 127.0.0.1,
#                                          accès par tunnel SSH)
# =============================================================
set -euo pipefail

BIND_ADDRESS="0.0.0.0"
[[ "${1:-}" == "--vps" ]] && BIND_ADDRESS="127.0.0.1"

LAB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$LAB_DIR"

if [[ ! -f .env ]]; then
  echo "==> Création de .env (BIND_ADDRESS=${BIND_ADDRESS})"
  DOCKER_GID="$(getent group docker | cut -d: -f3)"
  if [[ -z "$DOCKER_GID" ]]; then
    echo "Groupe docker introuvable : lancer d'abord sudo ./scripts/setup-vm.sh" >&2
    exit 1
  fi
  DB_PASSWORD="$(openssl rand -hex 24)"

  sed -e "s/^BIND_ADDRESS=.*/BIND_ADDRESS=${BIND_ADDRESS}/" \
      -e "s/^DOCKER_GID=.*/DOCKER_GID=${DOCKER_GID}/" \
      -e "s/^SONAR_DB_PASSWORD=.*/SONAR_DB_PASSWORD=${DB_PASSWORD}/" \
      .env.example > .env
  chmod 600 .env
fi

if [[ "$(sysctl -n vm.max_map_count)" -lt 524288 ]]; then
  echo "vm.max_map_count trop bas pour SonarQube : lancer sudo ./scripts/setup-vm.sh" >&2
  exit 1
fi

echo "==> Construction et démarrage des services"
docker compose up -d --build

echo
docker compose ps
echo
if grep -q "^BIND_ADDRESS=127.0.0.1" .env; then
  echo "Mode VPS : ports accessibles uniquement via tunnel SSH. Depuis ton poste :"
  echo "  ssh -L 8080:localhost:8080 -L 9000:localhost:9000 $(whoami)@<IP_VPS>"
  echo "Jenkins   : http://localhost:8080"
  echo "SonarQube : http://localhost:9000  (démarrage ~1 à 2 min)"
else
  IP="$(hostname -I | awk '{print $1}')"
  echo "Jenkins   : http://${IP}:8080"
  echo "SonarQube : http://${IP}:9000  (démarrage ~1 à 2 min)"
fi
echo
echo "Mot de passe initial Jenkins :"
echo "  docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword"
echo "Vérification : ./scripts/check-lab.sh"
