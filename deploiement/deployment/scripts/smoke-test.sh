#!/usr/bin/env bash
# =============================================================
# Tests de fumée de l'API déployée.
#
# Toujours : santé, disponibilité de la base, info, contrôle d'accès.
# Si ADMIN_EMAIL et ADMIN_PASSWORD sont définis : connexion, puis
# écriture/lecture/suppression d'un candidat (persistance PostgreSQL).
#
# Usage : ./scripts/smoke-test.sh
#         BASE_URL=http://192.168.x.x:4000 ./scripts/smoke-test.sh
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="$(grep -E '^API_PORT=' .env 2>/dev/null | cut -d= -f2 || true)"
BASE_URL="${BASE_URL:-http://localhost:${PORT:-4000}}"
API="${BASE_URL}/v1"
FAILED=0

expect() {
  local label="$1" expected="$2" code
  shift 2
  code="$(curl -s -o /dev/null -w '%{http_code}' "$@")"
  if [[ "$code" == "$expected" ]]; then
    printf '  [OK] %-45s HTTP %s\n' "$label" "$code"
  else
    printf '  [KO] %-45s HTTP %s (attendu %s)\n' "$label" "$code" "$expected"
    FAILED=1
  fi
}

echo "==> Tests de fumée sur ${API}"
expect "GET /health (API démarrée)"             200 "${API}/health"
expect "GET /ready (PostgreSQL joignable)"      200 "${API}/ready"
expect "GET /info"                              200 "${API}/info"
expect "GET /candidates sans token -> 401"      401 "${API}/candidates"

if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  TOKEN="$(curl -s -X POST "${API}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')" \
    | jq -r '.data.token // empty')"

  if [[ -z "$TOKEN" ]]; then
    echo "  [KO] Connexion de l'administrateur"
    FAILED=1
  else
    echo "  [OK] Connexion de l'administrateur (JWT obtenu)"
    AUTH=(-H "Authorization: Bearer ${TOKEN}")
    EMAIL="smoke-$(date +%s)@souverainrecrut.test"

    ID="$(curl -s -X POST "${API}/candidates" "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d "{\"fullName\":\"Smoke Test\",\"email\":\"${EMAIL}\"}" | jq -r '.data.id // empty')"

    if [[ -n "$ID" ]]; then
      echo "  [OK] POST /candidates (écriture en base)"
      expect "GET /candidates/:id (relecture en base)" 200 "${API}/candidates/${ID}" "${AUTH[@]}"
      expect "DELETE /candidates/:id (nettoyage)"      200 -X DELETE "${API}/candidates/${ID}" "${AUTH[@]}"
    else
      echo "  [KO] POST /candidates (écriture en base)"
      FAILED=1
    fi
  fi
else
  echo "  (ADMIN_EMAIL/ADMIN_PASSWORD non définis : tests authentifiés ignorés)"
fi

exit "$FAILED"
