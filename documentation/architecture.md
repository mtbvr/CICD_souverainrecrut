# Architecture de la chaîne CI/CD – SouverainRecrut Backend

## Vue d'ensemble

```
 ┌──────────── INTÉGRATION CONTINUE (Jenkins) ────────────┐
 │                                                        │
 │ GitHub (dev) ─▶ npm ci ─▶ prisma generate ─▶ tsc       │
 │                                  │                     │
 │       tests + couverture ◀───────┘                     │
 │              │                                         │
 │              ▼                                         │
 │   SonarQube ─▶ Quality Gate ─▶ docker build ─▶ Trivy   │
 │                                                 │      │
 └─────────────────────────────────────────────────┼──────┘
                                                   ▼
                                      Docker Hub (image versionnée)
                                      <compte>/souverainrecrut-backend:<version>-<commit>
                                                   │
 ┌──────────── PROVISIONNEMENT ET DÉPLOIEMENT ─────┼──────┐
 │                                                 │      │
 │ VMware ─▶ VM Ubuntu 24.04 ◀── Terraform (contrôle,     │
 │                ▲               inventaire)              │
 │                │◀───────────── Ansible (Docker, Compose, │
 │                │                pare-feu, runner)       │
 │                │                                       │
 │ GitLab CI/CD ──┘ SSH : validate → deploy (manuel) →    │
 │                       verify → rollback (manuel)        │
 │                │                                       │
 │                ▼  docker compose pull / up             │
 │        db (PostgreSQL) → migrate (Prisma) → api :4000  │
 └────────────────────────────────────────────────────────┘
```

Principe structurant : **l'image est construite une seule fois** (Jenkins), contrôlée, publiée, puis
**déployée telle quelle**. Le pipeline de déploiement ne reconstruit jamais l'image depuis le code
source : ce qui a été testé et scanné est exactement ce qui tourne en production.

## Composants

| Domaine | Outil | Rôle | Hébergement |
|---|---|---|---|
| Code source | GitHub | Dépôt applicatif, branche de travail `dev` | github.com |
| Intégration | Jenkins (LTS, image personnalisée) | Orchestration CI | Lab Docker Compose (VPS, accès tunnel SSH) |
| Qualité | SonarQube Community Build + PostgreSQL | Analyse statique, couverture, Quality Gate | Lab Docker Compose |
| Tests | Jest, Supertest, jest-mock-extended | Tests unitaires et d'API, couverture | Exécutés par Jenkins |
| Sécurité image | Trivy (conteneur) | Scan de vulnérabilités, seuil bloquant | Exécuté par Jenkins |
| Registre | Docker Hub | Stockage des images versionnées | hub.docker.com |
| Virtualisation | VMware Workstation | VM du serveur de déploiement | Poste de travail |
| Provisionnement | Terraform | Contrôle de la VM, inventaire Ansible | Poste (WSL) |
| Configuration | Ansible | Docker, Compose, pare-feu, runner GitLab | Poste (WSL) → VM |
| Déploiement | GitLab CI/CD + runner auto-hébergé | Validation, déploiement approuvé, vérification, rollback | gitlab.com + VM |
| Exécution | Docker Compose, PostgreSQL 17, Prisma | API + base de données | VM |

## Flux d'une modification

1. Push d'un commit sur `dev` (GitHub).
2. Jenkins détecte le commit (*poll SCM*, ~5 min) et lance le pipeline.
3. Installation, génération Prisma, compilation TypeScript stricte.
4. 97 tests, couverture **100 %** (seuil bloquant 80 %).
5. Analyse SonarQube, puis **Quality Gate `SouverainRecrut`** (conditions sur le code global et le nouveau code).
6. Construction de l'image (labels OCI : version, commit, date).
7. Scan Trivy : blocage si vulnérabilité **CRITICAL corrigeable**.
8. Publication sur Docker Hub : `<version>-<commit>` (immuable) et `dev` (mobile).
9. Lancement du pipeline GitLab avec `BACKEND_TAG=<version>-<commit>`.
10. Validation du tag et de sa présence sur Docker Hub.
11. **Approbation manuelle** du déploiement en production.
12. SSH vers la VM : fichiers, `.env` (variables protégées), `docker login`, `deploy.sh`.
13. `docker compose pull` puis démarrage : PostgreSQL (healthy) → migrations Prisma → API.
14. Healthcheck, tests de fumée ; retour automatique à la version précédente en cas d'échec.
15. Vérification : tag réellement exécuté, `/health`, `/ready`, persistance en base.

## Traçabilité

| Lien | Mécanisme |
|---|---|
| Commit → build Jenkins | Nom du build `#N <version>-<commit>` |
| Build → image | Tag `<version>-<commit>`, label `org.opencontainers.image.revision` (SHA complet) |
| Image → déploiement | Variable `BACKEND_TAG`, environnement GitLab `production` (historique des déploiements) |
| Déploiement → serveur | `releases.log` : date, tag, statut (`SUCCESS`, `FAILED`, `ROLLBACK`), version précédente |

## Sécurité de la chaîne

| Point | Mesure |
|---|---|
| Secrets CI | Credentials Jenkins (token SonarQube, access token Docker Hub), jamais dans le dépôt |
| Secrets CD | Variables GitLab masquées et protégées, `.env` transmis par stdin SSH, `umask 077` |
| Dépendances | Trivy bloque les CVE critiques corrigeables (cas réel : `proxy-addr` CVE-2026-90711) |
| Code | Quality Gate exigeant (cas réel : en-tête `X-Powered-By`, usage de `parseInt`) |
| Image | Multi-étapes, dépendances de production uniquement, utilisateur non-root, `.dockerignore` |
| Outillage CI | Jenkins et SonarQube liés à `127.0.0.1`, accès par tunnel SSH uniquement |
| Serveur | Clé SSH dédiée, `known_hosts` strict, pare-feu (SSH + API), PostgreSQL non exposé |
| Production | Approbation manuelle avant déploiement, un seul déploiement à la fois (`resource_group`) |

## Choix et limites assumées

| Choix | Justification | Limite |
|---|---|---|
| Prisma mocké dans les tests | Tests rapides, déterministes, sans base, exécutables par Jenkins | Requêtes SQL réelles validées au déploiement (tests de fumée) |
| Jenkins avec le socket Docker de l'hôte | Simple, rapide, cache de couches partagé | Accès équivalent root : hôte dédié, accès restreint |
| Poll SCM plutôt que webhook GitHub | Jenkins non exposé sur Internet | Délai de détection de ~5 min |
| Terraform sans création de VM | VMware Workstation n'est pas pilotable par le provider vSphere | VM créée manuellement |
| Runner GitLab sur la VM | Les runners partagés ne joignent pas une VM locale | Le runner a accès au Docker de la VM |
| Migrations dans un conteneur dédié | Appliquées avant l'API, avec la même image | Non réversibles automatiquement (cf. rollback) |
