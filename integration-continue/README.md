# Intégration continue – SouverainRecrut Backend

Chaîne CI du Backend : chaque build de la branche `dev` est testé, analysé, conteneurisé,
scanné puis publié sur Docker Hub, **uniquement si tous les contrôles sont passés**.

```
GitHub (dev) ─▶ Jenkins ─▶ npm ci ─▶ prisma generate ─▶ tsc ─▶ tests + couverture
                                                                    │
     Docker Hub ◀─ push ◀─ Trivy ◀─ docker build ◀─ Quality Gate ◀─ SonarQube
```

## Contenu

| Élément | Emplacement | Rôle |
|---|---|---|
| Jenkinsfile | [`Jenkinsfile`](Jenkinsfile) | Pipeline déclaratif complet |
| Dockerfile | [`backend/Dockerfile`](../backend/Dockerfile) + [`.dockerignore`](../backend/.dockerignore) | Image Backend (contexte de build : `backend/`) |
| Tests | [`backend/tests/`](../backend/tests/), [`jest.config.js`](../backend/jest.config.js) | Jest + Supertest, Prisma mocké |
| SonarQube | [`sonar/`](sonar/) + [`backend/sonar-project.properties`](../backend/sonar-project.properties) | Paramètres d'analyse et Quality Gate |
| Rapports | [`reports/`](reports/) | Rapports de tests, couverture, SonarQube, Trivy, captures |
| Lab | [`lab/`](lab/) | Jenkins + SonarQube en Docker Compose (VM VMware ou VPS ; ce projet : VPS) |

## Étapes du pipeline

| # | Étape | Commande | Bloquant si… |
|---|---|---|---|
| 1 | Checkout | `checkout scm` (branche `dev`) | dépôt inaccessible |
| 2 | Dépendances | `npm ci` | lockfile incohérent |
| 3 | Prisma | `npx prisma generate` | schéma invalide |
| 4 | Compilation | `npm run build` (tsc strict) | erreur de typage |
| 5 | Tests | `npm run test:ci` | test en échec **ou couverture < 80 %** |
| 6 | SonarQube | `npm run sonar` | analyse impossible |
| 7 | Quality Gate | `waitForQualityGate abortPipeline: true` | gate **FAILED** |
| 8 | Build image | `docker build backend/` | échec de build |
| 9 | Trivy | `trivy image …` | vulnérabilité **CRITICAL corrigeable** |
| 10 | Publication | `docker push` | uniquement sur `dev`, après 1 à 9 |

Rapports publiés dans Jenkins : résultats JUnit, couverture (plugin Coverage + rapport HTML
lcov), rapports Trivy et fichiers de couverture archivés comme artefacts.

## Tests et couverture

- **Outils** : Jest, ts-jest, Supertest, jest-mock-extended.
- **Stratégie** : le client Prisma est remplacé par un mock. Les tests d'API traversent la
  vraie chaîne Express (routes → JWT → rôles → validation Zod → controller → service →
  repository) sans base de données, donc exécutables tels quels sur l'agent Jenkins.
- **Périmètre** : authentification (login, `/me`, tokens absents/invalides/expirés),
  candidats, offres, candidatures, utilisateurs, tableau de bord, contrôle d'accès
  (401/403 par rôle), validation (400), conflits (409), ressources absentes (404), health checks.
- **Seuil** : 80 % (lignes, branches, fonctions, instructions) dans `jest.config.js` : le build échoue en dessous.
- **Rapports** : `coverage/lcov.info` (SonarQube), `coverage/cobertura-coverage.xml` (Jenkins), `reports/junit.xml` (Jenkins).

```bash
cd backend
npm ci && npx prisma generate
npm run test:ci
```

## Image Docker

Modifications apportées au Dockerfile fourni :

| Avant | Après | Raison |
|---|---|---|
| `node:20-alpine` | `node:22-alpine3.24` | Exigence Node 22+, base Alpine à jour |
| `COPY . .` sans `.dockerignore` | copies ciblées + `.dockerignore` | Ni `.env`, ni `node_modules` local, ni tests dans l'image |
| `npm ci --only=production` | `npm ci --omit=dev` | Option dépréciée remplacée |
| exécution en root | `USER node` | Moindre privilège |
| — | `apk upgrade`, `openssl` | Correctifs de sécurité de la base, prérequis Prisma |
| — | `HEALTHCHECK` sur `/v1/health` | État de santé visible par Docker / Compose |
| — | labels OCI (version, commit, date) | Traçabilité image ↔ code |
| `prisma` en devDependency | `prisma` en dependency | Permet `prisma migrate deploy` depuis l'image lors du déploiement |
| npm, npx, corepack, yarn présents | Supprimés de l'image finale | Inutiles à l'exécution, ils embarquaient 10 vulnérabilités HIGH |

Résultat du durcissement (Trivy) : de **26 HIGH à 1 HIGH**, 0 CRITICAL. Détail et risque résiduel
accepté dans [`reports/README.md`](reports/README.md).

### Stratégie de tags

| Tag | Exemple | Nature |
|---|---|---|
| `<version>-<commit>` | `1.0.0-a1b2c3d` | **Immuable**, relie l'image à la version de `package.json` et au commit Git. C'est ce tag que le déploiement utilise. |
| `dev` | `dev` | Mobile, pointe sur la dernière image validée de la branche `dev` (confort de test) |

Le commit complet est aussi inscrit dans le label `org.opencontainers.image.revision` :

```bash
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' <image>
```

### Politique Trivy

| Sévérité | Traitement |
|---|---|
| CRITICAL avec correctif disponible | **Bloquant** : l'image n'est pas publiée |
| CRITICAL sans correctif, HIGH | Reportées dans `trivy-report.txt` / `.json`, non bloquantes, à suivre |
| MEDIUM et moins | Présentes dans le rapport JSON |

Justification : on bloque ce qui est **actionnable** (mise à jour de la base ou d'une
dépendance). Bloquer sur des vulnérabilités sans correctif empêcherait toute livraison sans
gain de sécurité. Trivy s'exécute en conteneur (`aquasec/trivy`, version figée dans le
Jenkinsfile) avec une base de vulnérabilités mise en cache dans le volume `trivy-cache`.

## Mise en place dans Jenkins

Prérequis : le lab est démarré et configuré ([`lab/README.md`](lab/README.md), étapes 4 et 5) :
serveur SonarQube `sonarqube`, credentials `sonarqube-token` et `dockerhub-credentials`,
webhook SonarQube vers Jenkins, Quality Gate `SouverainRecrut` ([`sonar/README.md`](sonar/README.md)).

Créer le job : *New Item* → nom `souverainrecrut-backend-ci` → **Pipeline**, puis :

| Champ | Valeur |
|---|---|
| Definition | Pipeline script from SCM |
| SCM | Git |
| Repository URL | `https://github.com/mtbvr/CICD_souverainrecrut.git` |
| Credentials | aucun (dépôt public) ou `github-credentials` |
| Branch Specifier | `*/dev` |
| Script Path | `integration-continue/Jenkinsfile` |

Déclenchement **automatique** : `triggers { pollSCM('H/5 * * * *') }` dans le Jenkinsfile. Jenkins
vérifie le dépôt toutes les ~5 minutes et lance un build à chaque nouveau commit sur `dev`.
Le déclencheur est enregistré par Jenkins lors du **premier build manuel** qui suit son ajout.
Un webhook GitHub n'est pas utilisable : Jenkins n'est pas exposé sur Internet (accès par tunnel SSH).

## Gestion des secrets

- Aucun secret dans le dépôt : tokens SonarQube et Docker Hub stockés dans les
  **credentials Jenkins**, injectés uniquement le temps de l'étape qui les utilise et masqués dans les logs.
- Docker Hub : **access token** (révocable, droits limités), jamais le mot de passe du compte.
- `docker login --password-stdin` : le token n'apparaît ni dans la ligne de commande ni dans l'historique.
- Scripts `sh` entre guillemets simples : les secrets ne sont pas interpolés par Groovy.
- Image : `.dockerignore` exclut `.env*`. La configuration est fournie au conteneur à l'exécution.
- `DATABASE_URL` du pipeline : valeur factice (aucune base n'est utilisée par les tests).
