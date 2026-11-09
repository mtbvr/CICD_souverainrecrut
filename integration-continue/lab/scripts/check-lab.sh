#!/usr/bin/env bash
# =============================================================
# Vérification du lab : services, outils dans Jenkins, réseau
# Usage : ./scripts/check-lab.sh
# =============================================================
set -uo pipefail

LAB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$LAB_DIR"

JP="$(grep -E '^JENKINS_PORT=' .env 2>/dev/null | cut -d= -f2)"; export JP="${JP:-8080}"
SP="$(grep -E '^SONAR_PORT=' .env 2>/dev/null | cut -d= -f2)";   export SP="${SP:-9000}"

FAILED=0
check() {
  local label="$1"; shift
  if output="$("$@" 2>&1)"; then
    printf "  [OK]   %-38s %s\n" "$label" "$(echo "$output" | head -n1)"
  else
    printf "  [KO]   %-38s %s\n" "$label" "$(echo "$output" | head -n1)"
    FAILED=1
  fi
}

echo "== Conteneurs"
docker compose ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}"
echo

echo "== Services"
check "Jenkins répond (port $JP)" \
  sh -c 'curl -fsS -o /dev/null -w "HTTP %{http_code}" "http://localhost:$JP/login"'
check "SonarQube status UP (port $SP)" \
  sh -c 'curl -fsS "http://localhost:$SP/api/system/status" | grep -o "\"status\":\"UP\""'
check "Jenkins -> SonarQube (réseau ci)" \
  docker exec jenkins curl -fsS -o /dev/null -w "HTTP %{http_code}" http://sonarqube:9000/api/system/status
echo

echo "== Outils dans le conteneur Jenkins"
check "Node.js >= 22" docker exec jenkins node --version
check "npm" docker exec jenkins npm --version
check "Docker CLI -> daemon de la VM" \
  docker exec jenkins docker version --format "Server {{.Server.Version}}"
check "Docker buildx" docker exec jenkins docker buildx version
check "git" docker exec jenkins git --version
echo

if [[ "$FAILED" -eq 0 ]]; then
  echo "Lab opérationnel."
else
  echo "Au moins une vérification a échoué (SonarQube peut mettre ~2 min à démarrer)."
  exit 1
fi
