# Rapport final – Industrialisation de SouverainRecrut Backend

> Document de synthèse du projet fil rouge CI/CD. Partie 1 (intégration continue) : réalisée.
> Partie 2 (provisionnement et déploiement) : préparée, à exécuter sur la VM VMware.
> Les éléments `<à compléter>` le seront à l'issue de la seconde séance.

## 1. Objectif

Construire une chaîne de livraison automatisée, reproductible, sécurisée, traçable et documentée,
depuis une modification du code Backend jusqu'à l'API déployée avec PostgreSQL.
Architecture détaillée : [`architecture.md`](architecture.md).

## 2. Partie 1 – Intégration continue (Jenkins)

Compte rendu détaillé, avec captures : [`rapport-seance1-integration-continue.pdf`](rapport-seance1-integration-continue.pdf).

### Réalisations

| Exigence du cahier des charges | Réalisation | Preuve |
|---|---|---|
| Tests Backend | Jest + Supertest, Prisma mocké, 97 tests | [`junit.xml`](../integration-continue/reports/junit.xml) |
| Rapport de couverture | 100 % (seuil bloquant 80 %), LCOV + Cobertura | [`reports/`](../integration-continue/reports/) |
| SonarQube + Quality Gate | Gate `SouverainRecrut` (code global + nouveau code), Passed : A / A / A | [captures 04 à 10](../integration-continue/reports/README.md#captures-décran) |
| Jenkins + Jenkinsfile versionné | Pipeline déclaratif, 10 étapes, déclenchement automatique (poll SCM) | [`Jenkinsfile`](../integration-continue/Jenkinsfile) |
| Image reproductible, sans secret | Multi-étapes, `.dockerignore`, non-root, healthcheck, labels OCI | [`Dockerfile`](../backend/Dockerfile) |
| Tags explicites et traçables | `<version>-<commit>` immuable + `dev` | [`README`](../integration-continue/README.md#stratégie-de-tags) |
| Scan Trivy + seuils | CRITICAL corrigeable bloquant ; HIGH 26 → 1 après durcissement (build #5, `1.0.0-8b039e7`) | [`trivy-report.txt`](../integration-continue/reports/trivy-report.txt) |
| Publication conditionnée | Push Docker Hub en dernière étape, uniquement si tout est vert | [capture 09](../integration-continue/reports/captures/09-jenkins-pipeline-builds-1-a-4.png) |
| Secrets hors dépôt | Credentials Jenkins, access token Docker Hub, `--password-stdin` | [`README`](../integration-continue/README.md#gestion-des-secrets) |

### La chaîne a bloqué deux fois, comme prévu

| Build | Blocage | Cause | Correction |
|---|---|---|---|
| #1 | Trivy | CVE-2026-90711 (CRITICAL) dans `proxy-addr` 2.0.7, dépendance transitive d'Express | Lockfile : `proxy-addr` 2.0.8 |
| #3 | Quality Gate | Security B (`X-Powered-By` exposé), Reliability C (`parseInt`) ; tolérés par *Sonar way* | `app.disable("x-powered-by")`, `Number.parseInt`, test ajouté |

Ces deux incidents démontrent l'intérêt des contrôles : ni la vulnérabilité ni les défauts de code
n'auraient été détectés par une simple compilation, et aucune image non conforme n'a été publiée.

### Infrastructure CI

Jenkins et SonarQube (+ PostgreSQL) en Docker Compose ([`lab/`](../integration-continue/lab/)),
hébergés sur un VPS faute de ressources suffisantes sur le poste pour une VM supplémentaire.
Accès restreint : écoute sur `127.0.0.1`, tunnel SSH. Scripts compatibles VM VMware et VPS.

## 3. Partie 2 – Provisionnement et déploiement

### Préparé

| Exigence | Élément | Validation effectuée |
|---|---|---|
| Terraform | [`terraform/`](../deploiement/terraform/) : contrôle de la VM, inventaire Ansible | `init`, `validate`, `fmt`, `plan` (3 ressources) |
| Ansible | [`playbook.yml`](../deploiement/ansible/playbook.yml) : Docker, Compose, répertoire, pare-feu, runner | `--syntax-check`, `ansible-lint` profil *production* : 0 erreur |
| Docker Compose + PostgreSQL | [`docker-compose.yml`](../deploiement/deployment/docker-compose.yml) : db → migrate → api, volume, réseau, healthchecks | Démarrage réel, migrations, persistance après redémarrage |
| GitLab CI/CD | [`.gitlab-ci.yml`](../deploiement/.gitlab-ci.yml) : validate, deploy manuel, verify, rollback | `<à compléter : exécution sur GitLab>` |
| Rollback | [`rollback.sh`](../deploiement/deployment/scripts/rollback.sh) + retour automatique | Scénarios testés : déploiement, mise à jour, version cassée → retour auto, rollback manuel, tag invalide refusé |

### À réaliser en séance 2

- VM Ubuntu Server 24.04 sous VMware, utilisateur `deploy`, clé SSH dédiée.
- `terraform apply`, `ansible-playbook`, enregistrement du runner GitLab.
- Projet GitLab, variables protégées, déploiement de `<tag>` avec approbation.
- Scénario de rollback (cf. [`procedure-rollback.md`](procedure-rollback.md)).

Résultats : `<à compléter>`

## 4. Exigences de qualité et de sécurité

| Exigence | Mise en œuvre |
|---|---|
| Reproductibilité | Lockfiles, versions d'outils épinglées (Node 22, Trivy 0.76.1, provider Terraform verrouillé, runner 19.5.1), scripts et playbooks rejouables |
| Qualité logicielle | 97 tests, couverture 100 %, Quality Gate exigeant, `tsc` strict |
| Sécurité | Secrets dans Jenkins / GitLab, Trivy bloquant, image non-root sans gestionnaire de paquets, accès CI par tunnel, pare-feu |
| Traçabilité | Tag `<version>-<commit>`, label OCI `revision`, nom des builds, `releases.log`, environnement GitLab |
| Déploiement | Image tirée de Docker Hub, jamais reconstruite ; migrations Prisma avant démarrage |
| Continuité | Retour automatique en cas d'échec, rollback manuel, procédure documentée |
| Documentation | README par dossier, architecture, procédures, ce rapport |

## 5. Limites et améliorations possibles

| Limite | Amélioration |
|---|---|
| Tests sans base réelle (Prisma mocké) | Tests d'intégration sur PostgreSQL éphémère (conteneur de service) |
| Détection des commits par polling (~5 min) | Webhook GitHub via un reverse proxy HTTPS ou un relais |
| `deepmerge-ts` HIGH résiduel (Prisma 6) | Migration vers Prisma 7 |
| Rollback sans retour de schéma | Sauvegarde `pg_dump` automatique avant migration, migrations *expand / contract* |
| Un seul environnement | Environnement de recette déployé automatiquement avant la production |
| Jenkins avec le socket Docker | Agents de build dédiés et isolés |
