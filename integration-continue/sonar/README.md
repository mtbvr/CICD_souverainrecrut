# SonarQube – configuration et Quality Gate

## Paramètres d'analyse

Fichier : [`backend/sonar-project.properties`](../../backend/sonar-project.properties)
(placé dans `backend/`, répertoire depuis lequel le scanner est lancé).

| Paramètre | Valeur | Rôle |
|---|---|---|
| `sonar.projectKey` | `souverainrecrut-backend` | Identifiant du projet dans SonarQube |
| `sonar.sources` | `src` | Code applicatif analysé |
| `sonar.tests` | `tests` | Code de test (exclu des règles « code de production ») |
| `sonar.exclusions` | `src/docs/**`, `src/swagger/**` | Annotations Swagger : pas de logique applicative |
| `sonar.javascript.lcov.reportPaths` | `coverage/lcov.info` | Couverture produite par `npm run test:ci` |
| `sonar.coverage.exclusions` | `server.ts`, `config/prisma.ts`, `types/**` | Mêmes exclusions que `jest.config.js` (point d'entrée, singleton mocké, déclarations) |

Le scanner est la dépendance npm `@sonar/scan` (version figée par `package-lock.json`).
Il télécharge automatiquement le JRE fourni par le serveur SonarQube : aucun Java à
installer sur l'agent. Lancement : `npm run sonar` avec `SONAR_HOST_URL` et `SONAR_TOKEN`
dans l'environnement (injectés par Jenkins via `withSonarQubeEnv`).

## Quality Gate « SouverainRecrut »

Le Quality Gate par défaut *Sonar way* ne porte que sur le **nouveau code** : lors de la
première analyse, aucun code n'est « nouveau » et le gate passe sans rien vérifier.
Un gate dédié ajoute donc des conditions sur le **code global**.

Création : *Quality Gates → Create* → nom `SouverainRecrut`, puis *Projects* → associer
`souverainrecrut-backend`.

| Portée | Métrique | Condition | Justification |
|---|---|---|---|
| Code global | Coverage | < 80 % → échec | Même seuil que Jest (`coverageThreshold`) |
| Code global | Duplicated Lines (%) | > 3 % → échec | Limite la dette de copier-coller |
| Code global | Reliability Rating | moins bon que A → échec | Aucun bug |
| Code global | Security Rating | moins bon que A → échec | Aucune vulnérabilité |
| Code global | Maintainability Rating | moins bon que A → échec | Dette technique maîtrisée |
| Code global | Security Hotspots Reviewed | < 100 % → échec | Chaque hotspot est revu et justifié |
| Nouveau code | Coverage | < 80 % → échec | Toute évolution doit être testée |
| Nouveau code | Duplicated Lines (%) | > 3 % → échec | |
| Nouveau code | Issues | > 0 → échec | Aucun nouveau problème introduit |

Le pipeline Jenkins attend le résultat (`waitForQualityGate abortPipeline: true`) :
un gate **FAILED** arrête le build **avant** la construction et la publication de l'image.

## Revue des Security Hotspots

Les hotspots ne sont pas des vulnérabilités confirmées mais des points à vérifier
manuellement. **L'analyse finale n'en relève aucun** (0 hotspot, note A). Si un hotspot
apparaît, il est analysé puis marqué *Safe* (avec justification) ou *Fixed* : tant qu'il
n'est pas revu, la condition « Security Hotspots Reviewed < 100 % » fait échouer le gate.

## Résultats

| Étape | Résultat | Capture |
|---|---|---|
| Conditions du gate `SouverainRecrut` | Code global + nouveau code | [05](../reports/captures/05-sonarqube-quality-gate-conditions.png) |
| Build #3 | **Failed** : Reliability C (`parseInt`), Security B (`X-Powered-By`) | [07](../reports/captures/07-sonarqube-quality-gate-failed.png) |
| Corrections, build #4 | **Passed** : A / A / A, 0 problème, 0 hotspot, couverture 100 %, duplications 0 % | [10](../reports/captures/10-sonarqube-quality-gate-passed.png), [13](../reports/captures/13-sonarqube-tableau-de-bord.png) |
