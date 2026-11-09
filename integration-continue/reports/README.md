# Rapports et preuves d'exécution

Rapports produits par le pipeline Jenkins (archivés comme artefacts de build) et
captures d'écran à joindre au livrable.

| Fichier attendu | Origine |
|---|---|
| `junit.xml` | `backend/reports/junit.xml` (artefact Jenkins, étape *Tests*) |
| `coverage-summary.png` | Jenkins → build → *Couverture Jest* / *Couverture (lcov)* |
| `lcov.info`, `cobertura-coverage.xml` | `backend/coverage/` (artefact Jenkins) |
| `sonarqube-dashboard.png` | SonarQube → projet `souverainrecrut-backend` |
| `sonarqube-quality-gate.png` | SonarQube → statut du Quality Gate (Passed) |
| `trivy-report.txt`, `trivy-report.json` | `backend/reports/` (artefact Jenkins, étape *Scan Trivy*) |
| `jenkins-pipeline.png` | Jenkins → vue des étapes du build réussi |
| `dockerhub-tags.png` | Docker Hub → dépôt `souverainrecrut-backend` → *Tags* |

Pour récupérer les artefacts d'un build : Jenkins → build → *Build Artifacts*.

> Ne jamais déposer ici de fichier contenant un token, un mot de passe ou un `.env`.
