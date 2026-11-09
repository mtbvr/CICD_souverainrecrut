# Déploiement – SouverainRecrut Backend

Provisionnement d'un serveur Ubuntu sous VMware et déploiement automatisé de l'API à partir de
l'image **publiée par Jenkins sur Docker Hub**, sans jamais la reconstruire.

```
Jenkins ──push──▶ Docker Hub ◀──pull── VM Ubuntu (VMware)
                                        ▲   ├─ db       PostgreSQL 17 (volume persistant)
GitLab CI/CD ──SSH (runner sur la VM)───┘   ├─ migrate  prisma migrate deploy (éphémère)
  validate → deploy (manuel) → verify       └─ api      image <version>-<commit>, :4000
  rollback (manuel)
```

| Dossier | Contenu |
|---|---|
| [`terraform/`](terraform/) | Contrôle de la VM + génération de l'inventaire Ansible |
| [`ansible/`](ansible/) | Préparation du serveur : Docker, Compose, répertoire, pare-feu, runner GitLab |
| [`deployment/`](deployment/) | `docker-compose.yml`, `.env.example`, scripts de déploiement, tests de fumée, rollback |
| [`.gitlab-ci.yml`](.gitlab-ci.yml) | Pipeline de déploiement (racine du projet GitLab) |

Procédures détaillées : [`../documentation/procedure-deploiement.md`](../documentation/procedure-deploiement.md)
et [`../documentation/procedure-rollback.md`](../documentation/procedure-rollback.md).

---

## Poste de contrôle

Ansible ne s'exécute pas nativement sous Windows : Terraform et Ansible sont lancés depuis
**WSL (Ubuntu)**.

```bash
# Dans WSL
sudo apt update && sudo apt install -y ansible git
# Terraform : https://developer.hashicorp.com/terraform/install (dépôt APT HashiCorp)
cd ~ && git clone -b dev https://github.com/mtbvr/CICD_souverainrecrut.git
```

Cloner dans le répertoire personnel WSL (`~`), **pas** sous `/mnt/c` : Ansible ignore un
`ansible.cfg` situé dans un répertoire accessible en écriture à tous, ce qui est le cas de `/mnt/c`.

## 1. VM VMware

| Ressource | Valeur |
|---|---|
| Système | Ubuntu Server 24.04 LTS (ISO *live-server*) |
| vCPU / RAM / disque | 2 / 4 Go / 30 Go |
| Réseau | NAT |
| Installation | cocher *Install OpenSSH server* |

Sur la VM, créer l'utilisateur de déploiement (sudo sans mot de passe, requis par Ansible et Terraform) :

```bash
sudo adduser --disabled-password --gecos "" deploy
echo 'deploy ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/deploy
sudo chmod 440 /etc/sudoers.d/deploy
ip -4 addr show     # relever l'IP
```

Depuis WSL, créer une clé dédiée et l'installer sur la VM :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/souverainrecrut_deploy -N "" -C "souverainrecrut-deploy"
# Copier la clé publique dans /home/deploy/.ssh/authorized_keys de la VM, par ex. :
cat ~/.ssh/souverainrecrut_deploy.pub | ssh <ton_user>@<IP_VM> \
  "sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh && sudo tee -a /home/deploy/.ssh/authorized_keys && sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys"
ssh -i ~/.ssh/souverainrecrut_deploy deploy@<IP_VM> hostname
```

> **Snapshot VMware** : « Ubuntu installé – avant configuration ».

## 2. Terraform

```bash
cd ~/CICD_souverainrecrut/deploiement/terraform
cp terraform.tfvars.example terraform.tfvars    # renseigner vm_ip
terraform init
terraform validate
terraform plan
terraform apply
```

**Pourquoi ce périmètre ?** Le provider vSphere exige ESXi ou vCenter. VMware Workstation ne permet
pas de créer une VM avec Terraform : la VM est créée manuellement (étape 1). Terraform gère les
ressources réellement disponibles :

- `terraform_data.vm_check` : connexion SSH et contrôle des prérequis (Ubuntu 24.04, vCPU, RAM,
  python3, sudo, accès Internet). Un écart fait échouer l'`apply` ;
- `local_file.ansible_inventory` : inventaire Ansible généré à partir des variables (source unique
  de vérité pour l'IP, l'utilisateur et la clé) ;
- `local_file.environment_summary` : fiche de l'environnement et valeurs à reporter dans GitLab.

Avec un ESXi/vCenter, `terraform_data.vm_check` serait précédé d'une ressource
`vsphere_virtual_machine` (clonage d'un template Ubuntu), le reste restant identique.

## 3. Ansible

```bash
cd ~/CICD_souverainrecrut/deploiement/ansible
ansible-galaxy collection install -r requirements.yml
ansible deploy_servers -m ping
ansible-playbook playbook.yml
```

Le playbook est **idempotent** : un second passage doit afficher `changed=0` (hors mises à jour
système). Tags disponibles : `system`, `docker`, `deploy-dir`, `firewall`, `verify`, `runner`.

> **Snapshot VMware** : « Serveur préparé par Ansible ».

## 4. GitLab

1. Créer un projet GitLab dédié (ex. `souverainrecrut-deploiement`) et y pousser le **contenu** de
   ce dossier `deploiement/` (le `.gitlab-ci.yml` doit être à la racine du projet GitLab).
2. **Runner** : *Settings → CI/CD → Runners → New project runner*, tag `souverainrecrut-deploy`,
   cocher *Run untagged jobs* : non. Copier le token `glrt-…` puis :
   ```bash
   ansible-playbook playbook.yml --tags runner -e gitlab_runner_token=glrt-xxxxxxxx
   ```
   Désactiver les runners partagés du projet (*Instance runners* : off).
3. **Variables** : *Settings → CI/CD → Variables*

   | Clé | Type | Options | Valeur |
   |---|---|---|---|
   | `DOCKERHUB_USER` | Variable | – | compte Docker Hub |
   | `DOCKERHUB_TOKEN` | Variable | Masked, Protected | access token **lecture seule** |
   | `DEPLOY_HOST` | Variable | – | IP de la VM |
   | `DEPLOY_USER` | Variable | – | `deploy` |
   | `SSH_PRIVATE_KEY` | **File** | Protected | contenu de `~/.ssh/souverainrecrut_deploy` |
   | `SSH_KNOWN_HOSTS` | **File** | – | sortie de `ssh-keyscan -t ed25519 <IP_VM>` |
   | `POSTGRES_PASSWORD` | Variable | Masked, Protected | `openssl rand -hex 24` |
   | `JWT_SECRET` | Variable | Masked, Protected | `openssl rand -hex 32` |

   Les variables *Protected* ne sont exposées qu'aux branches protégées (branche par défaut).
4. **Environnement** : *Operate → Environments* → `production` est créé au premier déploiement.

## 5. Déploiement

*Build → Pipelines → Run pipeline* → `BACKEND_TAG = 1.0.0-172892d` → *Run*.

| Étape | Rôle |
|---|---|
| `validate:image-tag` | Format `<version>-<commit>` + présence de l'image sur Docker Hub |
| `validate:compose` | Syntaxe et interpolation du `docker-compose.yml` |
| `deploy:production` | **Bouton ▶ : approbation manuelle**, puis copie des fichiers, `.env`, login, `deploy.sh` |
| `verify:production` | Conteneurs, tag réellement en cours d'exécution, `/health`, `/ready`, tests de fumée |
| `rollback:production` | Manuel : retour à la version saine précédente |

Création du compte administrateur (une fois, sur la VM) :

```bash
cd /opt/souverainrecrut && ./scripts/create-admin.sh admin@souverainrecrut.fr
```

## Sécurité

- Aucun secret dans le dépôt : `.env`, `terraform.tfvars`, `inventory.ini`, clés et état Terraform
  sont ignorés par Git.
- Secrets dans les variables GitLab **masquées et protégées** ; le `.env` est transmis par l'entrée
  standard de SSH (jamais affiché) et créé en `umask 077` sur le serveur.
- Token Docker Hub par `--password-stdin`, `docker logout` en fin de job.
- Clé SSH **dédiée** au déploiement, vérification stricte de l'empreinte du serveur (`known_hosts`).
- PostgreSQL non exposé (réseau Docker interne) ; seul le port de l'API est ouvert.
- API exécutée en utilisateur non-root (image), healthcheck et redémarrage automatique.
