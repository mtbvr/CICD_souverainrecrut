#!/usr/bin/env bash
# =============================================================
# Retour arrière vers une version antérieure de l'API.
#
# Usage : ./scripts/rollback.sh            -> version saine précédente (releases.log)
#         ./scripts/rollback.sh <tag>      -> version explicite
#
# ATTENTION : seule l'image applicative est restaurée. Les migrations
# Prisma déjà appliquées NE sont PAS annulées (cf. procedure-rollback.md).
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

HISTORY="releases.log"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  [[ -f "$HISTORY" ]] || { echo "Aucun historique ($HISTORY) : préciser le tag" >&2; exit 1; }

  # Versions saines, dans l'ordre, sans doublons consécutifs
  mapfile -t HEALTHY < <(awk '$3 == "SUCCESS" || $3 == "ROLLBACK" { print $2 }' "$HISTORY" | uniq)
  CURRENT="${HEALTHY[-1]:-}"
  for (( i=${#HEALTHY[@]}-1; i>=0; i-- )); do
    if [[ "${HEALTHY[$i]}" != "$CURRENT" ]]; then
      TARGET="${HEALTHY[$i]}"
      break
    fi
  done
  [[ -n "$TARGET" ]] || { echo "Aucune version antérieure saine dans $HISTORY" >&2; exit 1; }
  echo "Version actuelle : ${CURRENT} -> retour à : ${TARGET}"
fi

echo "==> Historique récent :"
tail -n 5 "$HISTORY" 2>/dev/null || true

DEPLOY_STATUS_LABEL=ROLLBACK exec ./scripts/deploy.sh "$TARGET"
