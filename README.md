# SouverainRecrut

## Projet fil rouge CI/CD – livrables

Industrialisation du **Backend** de SouverainRecrut (module CI/CD, Mastère RNCP 40166) –
Matéo Bouvier. Le Frontend est hors périmètre.

| Séance | Contenu | Où |
|---|---|---|
| 1 – Intégration continue | Jenkinsfile, tests Jest, SonarQube + Quality Gate, Dockerfile, Trivy, publication Docker Hub | [`integration-continue/`](integration-continue/) |
| 1 – Preuves | Rapports de tests, couverture, Trivy, captures d'écran | [`integration-continue/reports/`](integration-continue/reports/) |
| 1 – Compte rendu | Rapport de la séance 1 (PDF) | [`documentation/rapport-seance1-integration-continue.pdf`](documentation/rapport-seance1-integration-continue.pdf) |
| 2 – Déploiement | Terraform, Ansible, Docker Compose, GitLab CI/CD (préparé, à exécuter en séance 2) | [`deploiement/`](deploiement/) |
| Synthèse | Architecture, procédures de déploiement et de rollback, rapport final | [`documentation/`](documentation/) |

Image publiée : [`mtbvr/souverainrecrut-backend`](https://hub.docker.com/r/mtbvr/souverainrecrut-backend),
version de référence `1.0.0-8b039e7`.

La suite de ce README est celle du projet d'origine.

---

## Présentation

SouverainRecrut est une plateforme web de gestion des recrutements destinée aux entreprises.

Elle permet de :

- gérer les candidats ;
- publier des offres d'emploi ;
- suivre les candidatures ;
- centraliser le processus de recrutement.

Ce projet est utilisé comme **projet fil rouge** des cours  DevOps.

---

## Architecture

Le projet est composé de deux applications.

```
Frontend (React)
        │
        ▼
Backend (Express API)
        │
        ▼
PostgreSQL
```

---

## Stack technique

### Frontend

- React
- TypeScript
- Vite
- Axios
- Material UI

### Backend

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL

### DevOps

- Git
- GitLab
- Docker
- GitLab CI/CD
- Terraform
- Ansible
- Nginx

---

## Arborescence

```
souverainrecrut/
│
├── backend/
├── frontend/
├── docs/
└── README.md
```

---

## Auteur

ALIMOU DIALLO