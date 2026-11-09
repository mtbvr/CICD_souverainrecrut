# Rapports et preuves d'exécution

## Rapports

| Fichier | Contenu | Utilisé par |
|---|---|---|
| [`junit.xml`](junit.xml) | Résultats des 97 tests (12 suites) | Jenkins (*Test Result*) |
| [`tests-console.txt`](tests-console.txt) | Sortie console de `npm run test:ci`, tableau de couverture par fichier | Lecture |
| [`lcov.info`](lcov.info) | Couverture au format LCOV | SonarQube |
| [`cobertura-coverage.xml`](cobertura-coverage.xml) | Couverture au format Cobertura | Jenkins (plugin Coverage) |
| [`trivy-report.json`](trivy-report.json) | Scan Trivy complet de l'image (toutes sévérités) | Archivage, analyse |
| [`trivy-report.txt`](trivy-report.txt) | Scan Trivy, sévérités HIGH et CRITICAL (tableau) | Lecture |

Ces rapports sont produits par les mêmes commandes que le pipeline (`npm run test:ci`, Trivy
0.76.1), exécutées sur l'état final du dépôt. Les rapports de chaque build Jenkins sont en outre
archivés comme artefacts (*Build Artifacts*) : `backend/reports/` et `backend/coverage/`.

### Synthèse des tests

| Indicateur | Valeur |
|---|---|
| Tests | **97 réussis / 97** (12 suites) |
| Couverture lignes / branches / fonctions / instructions | **100 % / 100 % / 100 % / 100 %** |
| Seuil bloquant (`jest.config.js`) | 80 % |

### Synthèse Trivy et évolution

| Image | CRITICAL | HIGH | MEDIUM | LOW | Seuil (CRITICAL corrigeable) |
|---|---|---|---|---|---|
| Build #1 `1.0.0-61c559b` | **1** (`proxy-addr`) | – | – | – | **Bloqué** |
| `1.0.0-172892d` | 0 | 26 | 20 | 3 | Passé |
| Image durcie (état actuel du dépôt) | 0 | **1** | 4 | 0 | Passé |

Actions menées entre `1.0.0-172892d` et l'image durcie :

| Origine des vulnérabilités | Action | Effet |
|---|---|---|
| npm, npx, corepack, yarn embarqués dans l'image Node (`pacote`, `sigstore`, `picomatch`, `ip-address`, `brace-expansion`…) | Supprimés de l'image finale : inutiles à l'exécution | −10 HIGH |
| Dépendances transitives de l'API (`body-parser`, `fast-uri`, `js-yaml`, `brace-expansion`) | Mise à jour ciblée du lockfile (versions corrigées, compatibles) | −14 HIGH |
| `effect` (dépendance de Prisma) | Prisma 6.16.2 → 6.19.3 (même version majeure) | −1 HIGH |

**Risque résiduel accepté** : `deepmerge-ts` 7.1.5 (CVE-2026-40345, HIGH). Version épinglée par
Prisma 6 (`@prisma/config`), correctif uniquement en 8.0.0. Le paquet n'est utilisé que par la CLI
Prisma pour charger sa configuration lors des migrations, pas par l'API en fonctionnement.
Levée prévue lors de la migration vers Prisma 7.

## Captures d'écran

| Capture | Ce qu'elle montre |
|---|---|
| [`01-sonarqube-webhook-refuse-ssrf.png`](captures/01-sonarqube-webhook-refuse-ssrf.png) | Webhook vers Jenkins refusé par la protection SSRF de SonarQube (avant réglage) |
| [`02-jenkins-build1-bloque-trivy.png`](captures/02-jenkins-build1-bloque-trivy.png) | Build #1 arrêté à l'étape Trivy (CVE critique `proxy-addr`), image non publiée |
| [`03-jenkins-build2-publie.png`](captures/03-jenkins-build2-publie.png) | Build #2 après correction : pipeline complet, image publiée |
| [`04-sonarqube-sonar-way-passed.png`](captures/04-sonarqube-sonar-way-passed.png) | Gate par défaut *Sonar way* : Passed malgré Security B et Reliability C |
| [`05-sonarqube-quality-gate-conditions.png`](captures/05-sonarqube-quality-gate-conditions.png) | Conditions du Quality Gate `SouverainRecrut` (nouveau code + code global) |
| [`06-jenkins-build3-bloque-quality-gate.png`](captures/06-jenkins-build3-bloque-quality-gate.png) | Build #3 arrêté au Quality Gate : ni build, ni scan, ni publication |
| [`07-sonarqube-quality-gate-failed.png`](captures/07-sonarqube-quality-gate-failed.png) | Détail de l'échec : Reliability Rating C, Security Rating B |
| [`08-sonarqube-issues.png`](captures/08-sonarqube-issues.png) | Problèmes relevés : `X-Powered-By`, `parseInt` |
| [`09-jenkins-pipeline-builds-1-a-4.png`](captures/09-jenkins-pipeline-builds-1-a-4.png) | Historique complet : #1 bloqué (Trivy), #3 bloqué (Quality Gate), #4 vert |
| [`10-sonarqube-quality-gate-passed.png`](captures/10-sonarqube-quality-gate-passed.png) | Résultat final : A / A / A, 0 problème, couverture 100 %, gate Passed |
| [`11-jenkins-tests-97-reussis.png`](captures/11-jenkins-tests-97-reussis.png) | Résultats JUnit publiés par Jenkins : 97 tests réussis |
| [`12-jenkins-couverture-100.png`](captures/12-jenkins-couverture-100.png) | Couverture publiée par Jenkins : 100 %, tendance sur les builds #1 à #4 |
| [`13-sonarqube-tableau-de-bord.png`](captures/13-sonarqube-tableau-de-bord.png) | Tableau de bord SonarQube : gate Passed, 0 problème, 0 % de duplication |
| [`14-sonarqube-webhook-livraison-ok.png`](captures/14-sonarqube-webhook-livraison-ok.png) | Webhook SonarQube → Jenkins configuré, dernière livraison réussie |
| [`15-jenkins-credentials.png`](captures/15-jenkins-credentials.png) | Credentials Jenkins : identifiants uniquement, valeurs masquées |
| [`16-dockerhub-depot.png`](captures/16-dockerhub-depot.png) | Dépôt Docker Hub `mtbvr/souverainrecrut-backend` |

> Aucun fichier de ce dossier ne contient de secret (token, mot de passe, `.env`).
