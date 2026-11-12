# Procédure de déploiement

Objectif : mettre en production une version de l'API **déjà validée par Jenkins** et publiée sur
Docker Hub. Prérequis d'installation (VM, Terraform, Ansible, GitLab) : [`../deploiement/README.md`](../deploiement/README.md).

## 1. Identifier la version à déployer

La version est le tag immuable `<version>-<commit>` publié par Jenkins :

- Jenkins → job `souverainrecrut-backend-ci` → dernier build vert → nom du build (`#N 1.0.0-xxxxxxx`) ;
- ou Docker Hub → `souverainrecrut-backend` → *Tags*.

Vérifier la correspondance avec le code :

```bash
docker pull <compte>/souverainrecrut-backend:<tag>
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
  <compte>/souverainrecrut-backend:<tag>
```

## 2. Lancer le pipeline GitLab

1. GitLab → *Build → Pipelines → Run pipeline* (branche par défaut).
2. Variable `BACKEND_TAG` = le tag choisi → *Run pipeline*.
3. Contrôles automatiques :
   - `validate:image-tag` : format du tag et présence de l'image sur Docker Hub ;
   - `validate:compose` : validité du fichier Compose.
4. **Approbation** : vérifier le tag affiché, puis cliquer sur ▶ du job `deploy:production`.

## 3. Ce que fait le déploiement

Sur la VM, dans `/opt/souverainrecrut` :

| Étape | Détail |
|---|---|
| Fichiers | `docker-compose.yml` et `scripts/` copiés depuis le dépôt GitLab |
| Configuration | `.env` régénéré depuis les variables protégées (droits `600`) |
| Image | `docker login` puis `docker compose pull` : **aucune reconstruction** |
| Base | PostgreSQL démarré, attente du healthcheck `pg_isready` |
| Migrations | Conteneur `migrate` : `prisma migrate deploy` (migrations embarquées dans l'image) ; l'API ne démarre que s'il réussit |
| API | Démarrage, attente de l'état `healthy` (`/v1/health`, 120 s max) |
| Tests de fumée | `/health`, `/ready` (base joignable), `/info`, refus sans token (401) |
| Succès | Ligne `SUCCESS` dans `releases.log` |
| Échec | Ligne `FAILED`, journaux affichés, **retour automatique** à la version saine précédente (`ROLLBACK`) |

## 4. Vérifier

Le job `verify:production` contrôle automatiquement l'état des conteneurs, le tag réellement en
cours d'exécution, `/health`, `/ready` et les tests de fumée.

Vérification manuelle sur la VM :

```bash
cd /opt/souverainrecrut
docker compose ps                         # db, api : healthy ; migrate : exited (0)
docker compose logs --tail 50 api
cat releases.log
curl -s http://localhost:4000/v1/health
curl -s http://localhost:4000/v1/ready    # "database":"CONNECTED"
```

Tests fonctionnels complets (connexion, écriture et relecture en base) :

```bash
./scripts/create-admin.sh admin@souverainrecrut.fr        # première fois uniquement
read -r -s ADMIN_PASSWORD && export ADMIN_PASSWORD ADMIN_EMAIL=admin@souverainrecrut.fr
./scripts/smoke-test.sh
```

## 5. Persistance des données

Les données PostgreSQL sont dans le volume nommé `souverainrecrut-db-data`. Elles survivent au
redémarrage et au remplacement des conteneurs :

```bash
docker compose restart api db && ./scripts/smoke-test.sh
docker compose down && docker compose up -d     # sans -v : volume conservé
```

> `docker compose down -v` **supprime** le volume et donc toutes les données.

## 6. En cas de problème

| Symptôme | Piste |
|---|---|
| `validate:image-tag` échoue | Tag mal saisi, ou image non publiée (build Jenkins en échec) |
| Job bloqué « pending » | Runner GitLab arrêté : `docker ps` sur la VM, conteneur `gitlab-runner` |
| `Host key verification failed` | `SSH_KNOWN_HOSTS` à régénérer (`ssh-keyscan`) après réinstallation de la VM |
| `migrate` en échec | `docker compose logs migrate` : migration incompatible, base inaccessible |
| API `unhealthy` | `docker compose logs api` : variable manquante, `DATABASE_URL` incorrecte |
| Retour automatique effectué | Consulter `releases.log` et les journaux, corriger, redéployer |
