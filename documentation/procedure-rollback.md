# Procédure de rollback

Objectif : revenir rapidement à une version antérieure **saine** de l'API, identifiée par son tag
d'image `<version>-<commit>`.

## Principe

Chaque version est une image immuable sur Docker Hub. Revenir en arrière consiste à redéployer un
tag précédent : **aucune reconstruction**, l'image est déjà testée, scannée et publiée. Les images
précédentes restant en cache sur la VM, le retour est quasi immédiat.

L'historique des versions est tenu sur le serveur dans `/opt/souverainrecrut/releases.log` :

```
2026-11-10T09:12:03Z 1.0.0-563928b SUCCESS -
2026-11-10T10:40:51Z 1.0.0-172892d SUCCESS 1.0.0-563928b
```

## Trois niveaux de rollback

### 1. Automatique (pendant un déploiement)

Si la nouvelle version échoue (migration en erreur, API non `healthy`, test de fumée KO),
`deploy.sh` restaure immédiatement la dernière version saine et l'inscrit `ROLLBACK` dans
`releases.log`. Le pipeline reste en échec pour signaler le problème.

### 2. Par le pipeline GitLab (procédure nominale)

1. *Build → Pipelines → Run pipeline*.
2. Laisser `BACKEND_TAG` **vide** ; renseigner `ROLLBACK_TAG` pour cibler une version précise
   (vide = version saine précédente).
3. Déclencher manuellement le job **`rollback:production`**.
4. Le job affiche l'historique, tire l'image et applique `rollback.sh` (mêmes contrôles qu'un
   déploiement : healthcheck et tests de fumée).

Variante : relancer un pipeline de déploiement normal avec `BACKEND_TAG=<ancien tag>`.

### 3. Manuel sur le serveur (secours)

```bash
cd /opt/souverainrecrut
tail releases.log
./scripts/rollback.sh                    # version saine précédente
./scripts/rollback.sh 1.0.0-563928b      # ou version explicite
docker compose ps && ./scripts/smoke-test.sh
```

## Base de données : limite du rollback

**Le rollback applicatif ne restaure pas le schéma de la base.** Les migrations Prisma déjà
appliquées par une version plus récente restent en place. `prisma migrate deploy` (exécuté par
l'ancienne image) n'applique que les migrations manquantes et n'en annule aucune.

Conséquence : une ancienne version ne fonctionne après rollback que si le schéma actuel lui reste
**compatible**. Règles de conception des migrations (stratégie *expand / contract*) :

| À faire | À éviter dans une même version |
|---|---|
| Ajouter une colonne **nullable** ou avec valeur par défaut | Ajouter une colonne `NOT NULL` sans défaut |
| Ajouter une table, un index | Supprimer ou renommer une colonne encore lue par la version précédente |
| Supprimer une colonne **une version plus tard**, quand plus aucun code ne l'utilise | Changer le type d'une colonne utilisée |

Pour une migration non rétro-compatible inévitable :

1. sauvegarde avant déploiement :
   `docker compose exec -T db pg_dump -U souverainrecrut souverainrecrut > backup-$(date +%F-%H%M).sql` ;
2. en cas de rollback, restauration de la sauvegarde **puis** déploiement de l'ancienne image
   (perte des données écrites entre-temps, à arbitrer).

## Scénario de test maîtrisé

Prérequis : deux versions publiées, par exemple `1.0.0-563928b` et `1.0.0-172892d`.

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Déployer `1.0.0-563928b` | `SUCCESS`, en-tête `X-Powered-By: Express` présent |
| 2 | Créer un candidat de test (API) | Candidat enregistré |
| 3 | Déployer `1.0.0-172892d` | `SUCCESS`, en-tête `X-Powered-By` **absent** (correctif SonarQube) |
| 4 | Lancer `rollback:production` (ROLLBACK_TAG vide) | Retour à `1.0.0-563928b`, statut `ROLLBACK` dans `releases.log` |
| 5 | Vérifier | En-tête `X-Powered-By` de retour, **candidat de l'étape 2 toujours présent** (persistance), `/ready` OK |
| 6 | Redéployer `1.0.0-172892d` | Retour à la version courante |

Contrôle de la version réellement servie :

```bash
curl -sI http://<IP_VM>:4000/v1/health | grep -i x-powered-by     # présent = 563928b, absent = 172892d
docker inspect --format '{{.Config.Image}}' $(docker compose ps -q api)
```

Les deux versions partagent le même schéma (migration `init` unique) : le rollback est sans risque
pour la base dans ce scénario.
