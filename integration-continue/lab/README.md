# Lab CI – Jenkins + SonarQube sur VMware

Environnement d'intégration continue du projet SouverainRecrut : une VM Ubuntu Server
hébergeant, via Docker Compose, **Jenkins** (orchestration CI) et **SonarQube** (qualité
+ Quality Gate) avec sa base **PostgreSQL**.

```
 VM Ubuntu Server 24.04 (VMware)
 ┌───────────────────────────────────────────────────────────────┐
 │  Docker Engine                                                │
 │  ┌──────────────────┐  réseau "ci"  ┌──────────────┐  ┌──────┐ │
 │  │ jenkins  :8080   │ ────────────▶ │ sonarqube    │─▶│ sonar│ │
 │  │ Node 22, Docker  │ ◀──────────── │ :9000        │  │ -db  │ │
 │  │ CLI, plugins     │   webhook QG  └──────────────┘  └──────┘ │
 │  └────────┬─────────┘                                         │
 │           │ /var/run/docker.sock                              │
 │           ▼                                                   │
 │   daemon Docker de la VM : build image backend, Trivy, push   │
 └───────────────────────────────────────────────────────────────┘
```

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | Stack Jenkins + SonarQube + PostgreSQL, volumes persistants, réseau `ci` |
| `jenkins/Dockerfile` | Image Jenkins LTS + Node.js 22 + Docker CLI/buildx + plugins |
| `jenkins/plugins.txt` | Plugins installés au build (Pipeline, Git, SonarQube, JUnit, Coverage…) |
| `.env.example` | Modèle de configuration (le `.env` réel est généré et **non versionné**) |
| `scripts/setup-vm.sh` | Prépare la VM : Docker, paramètres noyau SonarQube, pare-feu |
| `scripts/start-lab.sh` | Génère `.env` et démarre la stack |
| `scripts/check-lab.sh` | Vérifie services, outils et connectivité |

---

## 1. Création de la VM (VMware Workstation)

| Ressource | Valeur | Justification |
|---|---|---|
| Système | Ubuntu Server 24.04 LTS | Imposé par le cahier des charges |
| vCPU | 4 | Jenkins + SonarQube (Elasticsearch) + builds Docker |
| RAM | **8 Go** | SonarQube seul consomme 2 à 3 Go |
| Disque | 50 Go | Images Docker, base Trivy, volumes |
| Réseau | NAT ou Bridged | Accès Internet + accès depuis l'hôte |

Pendant l'installation d'Ubuntu : cocher **Install OpenSSH server**.

Après installation, depuis la VM :

```bash
ip -4 addr show          # relever l'IP de la VM
ping -c 2 google.com     # vérifier l'accès Internet
```

Depuis le poste hôte : `ssh <utilisateur>@<IP_VM>`.

> **Snapshot VMware n°1** : « Ubuntu installé – avant configuration ».

## 2. Préparation de la VM

```bash
git clone https://github.com/<VOTRE_UTILISATEUR>/souverainrecrut.git
cd souverainrecrut/integration-continue/lab
chmod +x scripts/*.sh
sudo ./scripts/setup-vm.sh
exit                      # se reconnecter pour appliquer le groupe docker
```

## 3. Démarrage de la stack

```bash
cd souverainrecrut/integration-continue/lab
./scripts/start-lab.sh
./scripts/check-lab.sh    # relancer si SonarQube n'est pas encore UP
```

> **Snapshot VMware n°2** : « Lab Jenkins + SonarQube démarré ».

## 4. Initialisation de SonarQube

1. Ouvrir `http://<IP_VM>:9000`, se connecter avec `admin` / `admin`, définir un nouveau mot de passe.
2. **Créer le projet** : *Create Project → Local project*
   - Project key : `souverainrecrut-backend`
   - Display name : `SouverainRecrut Backend`
   - Main branch : `dev`
3. **Générer un token** pour Jenkins : *My Account → Security → Generate Tokens*
   - Name : `jenkins`, Type : *Global Analysis Token* → copier le token.
4. **Webhook vers Jenkins** (nécessaire à l'étape *Quality Gate* du pipeline) :
   *Administration → Configuration → Webhooks → Create*
   - Name : `jenkins`
   - URL : `http://jenkins:8080/sonarqube-webhook/` (résolution DNS interne au réseau `ci`)

## 5. Initialisation de Jenkins

1. Ouvrir `http://<IP_VM>:8080` et saisir le mot de passe initial :
   ```bash
   docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
2. *Select plugins to install* → **None** (les plugins sont déjà inclus dans l'image), puis créer le compte administrateur.
3. **Credentials** : *Manage Jenkins → Credentials → System → Global → Add Credentials*

   | ID | Type | Contenu |
   |---|---|---|
   | `sonarqube-token` | Secret text | Token SonarQube généré à l'étape 4.3 |
   | `dockerhub-credentials` | Username with password | Identifiant Docker Hub + **access token** Docker Hub (pas le mot de passe) |
   | `github-credentials` | Username with password | *(uniquement si le fork est privé)* identifiant GitHub + personal access token |

   Token Docker Hub : *hub.docker.com → Account settings → Personal access tokens* (droits *Read & Write*).

4. **Serveur SonarQube** : *Manage Jenkins → System → SonarQube servers*
   - cocher *Environment variables*
   - Name : `sonarqube`
   - Server URL : `http://sonarqube:9000`
   - Server authentication token : `sonarqube-token`

5. **Quality Gate et job du pipeline** : créer le Quality Gate `SouverainRecrut`
   ([`../sonar/README.md`](../sonar/README.md)) puis le job Pipeline
   ([`../README.md`](../README.md#mise-en-place-dans-jenkins)).

> **Snapshot VMware n°3** : « Lab configuré ».

## 6. Vérification finale

```bash
./scripts/check-lab.sh
```

Résultat attendu : tous les contrôles `[OK]` (Jenkins, SonarQube UP, Jenkins → SonarQube,
Node.js 22, accès au daemon Docker depuis Jenkins).

## Variante : lab sur un VPS

Même stack, mais le serveur est exposé sur Internet. Différences :

- `sudo ./scripts/setup-vm.sh --vps` : le pare-feu n'ouvre **que** SSH (port détecté automatiquement).
- `./scripts/start-lab.sh --vps` : Jenkins et SonarQube écoutent sur `127.0.0.1` uniquement
  (`BIND_ADDRESS` dans `.env`). Docker contourne UFW pour les ports publiés : c'est cette liaison
  locale, et non le pare-feu, qui empêche l'accès public.
- Accès depuis le poste par tunnel SSH, puis `http://localhost:8080` et `http://localhost:9000` :
  ```bash
  ssh -L 8080:localhost:8080 -L 9000:localhost:9000 <utilisateur>@<IP_VPS>
  ```
- Prérequis : x86_64 (amd64), 8 Go de RAM, 4 vCPU. Le VPS ne doit pas héberger d'autres services
  sensibles (l'accès de Jenkins au socket Docker équivaut à un accès root).

## Exploitation

```bash
docker compose ps                 # état
docker compose logs -f sonarqube  # logs d'un service
docker compose stop               # arrêt (données conservées)
docker compose up -d              # redémarrage
docker compose down -v            # suppression complète, volumes inclus (irréversible)
```

## Choix techniques et sécurité

- **Jenkins conteneurisé avec le socket Docker de la VM** : Jenkins construit l'image backend
  et lance Trivy sur le daemon de la VM sans Docker-in-Docker. Contrepartie : l'accès au socket
  équivaut à un accès root sur la VM. Acceptable pour une VM de lab dédiée et isolée, à remplacer
  en production par des agents de build dédiés.
- **Node.js intégré à l'image Jenkins** (copié de l'image officielle `node:22`) : version maîtrisée,
  pas de téléchargement à chaque build.
- **Secrets** : aucun secret dans le dépôt. Le mot de passe PostgreSQL est généré dans `.env`
  (`chmod 600`, ignoré par Git), les tokens SonarQube/Docker Hub sont stockés dans les credentials
  Jenkins et masqués dans les logs.
- **PostgreSQL de SonarQube non exposé** : accessible uniquement sur le réseau Docker `ci`.
- **Reproductibilité** : la VM est préparée par script, la stack est décrite en Compose et les
  plugins Jenkins sont figés dans l'image. Pour un environnement totalement figé, épingler
  `SONARQUBE_TAG` et la version de Jenkins sur des versions précises.

## Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `sonarqube` redémarre en boucle, log `max virtual memory areas vm.max_map_count` | `sudo sysctl -w vm.max_map_count=524288` (persisté par `setup-vm.sh`) |
| `permission denied ... docker.sock` dans Jenkins | `DOCKER_GID` incorrect dans `.env` : `getent group docker`, corriger puis `docker compose up -d` |
| `docker: permission denied` sur la VM | Se reconnecter en SSH après `setup-vm.sh` (groupe docker) |
| SonarQube lent / tué (OOM) | Augmenter la RAM de la VM (8 Go recommandés) |
| Quality Gate bloqué en attente dans Jenkins | Vérifier le webhook SonarQube `http://jenkins:8080/sonarqube-webhook/` |
