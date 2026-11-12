#!/usr/bin/env bash
# =============================================================
# Crée (ou réinitialise) le compte administrateur de l'API.
#
# L'API n'a pas de route d'inscription : le premier compte ADMIN
# est créé ici, avec le client Prisma et bcrypt déjà présents
# dans l'image. Le mot de passe est saisi sans écho.
#
# Usage : ./scripts/create-admin.sh admin@souverainrecrut.fr
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

EMAIL="${1:?Usage : create-admin.sh <email>}"
read -r -s -p "Mot de passe (8 caractères minimum) : " PASSWORD
echo
[[ ${#PASSWORD} -ge 8 ]] || { echo "Mot de passe trop court" >&2; exit 1; }

docker compose exec -T \
  -e ADMIN_EMAIL="$EMAIL" \
  -e ADMIN_PASSWORD="$PASSWORD" \
  api node -e '
    const bcrypt = require("bcrypt");
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    (async () => {
      const email = process.env.ADMIN_EMAIL.toLowerCase();
      const password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await prisma.user.upsert({
        where: { email },
        update: { password, role: "ADMIN" },
        create: { email, password, role: "ADMIN", firstName: "Admin", lastName: "SouverainRecrut" },
      });
      console.log("Administrateur prêt : " + email);
    })()
      .catch((e) => { console.error(e.message); process.exitCode = 1; })
      .finally(() => prisma.$disconnect());
  '
