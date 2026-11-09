#!/usr/bin/env bash
# =============================================================
# Préparation de la VM Ubuntu Server 24.04 du lab CI
#   - mise à jour du système
#   - Docker Engine + plugin Compose (dépôt officiel Docker)
#   - paramètres noyau requis par SonarQube (Elasticsearch)
#   - pare-feu (SSH, + Jenkins/SonarQube en mode VM locale)
#
# Usage : sudo ./scripts/setup-vm.sh          (VM VMware locale)
#         sudo ./scripts/setup-vm.sh --vps    (VPS exposé sur Internet :
#                                              seul SSH est ouvert)
# =============================================================
set -euo pipefail

MODE="vm"
[[ "${1:-}" == "--vps" ]] && MODE="vps"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Ce script doit être lancé avec sudo." >&2
  exit 1
fi

ARCH="$(dpkg --print-architecture)"
if [[ "$ARCH" != "amd64" ]]; then
  echo "ATTENTION : architecture $ARCH. L'image backend construite ici ne tournera pas"
  echo "            sur une VM x86_64 sans build multi-architecture."
fi

TARGET_USER="${SUDO_USER:-root}"

export DEBIAN_FRONTEND=noninteractive

if command -v docker > /dev/null && docker compose version > /dev/null 2>&1; then
  # Serveur existant : on ne touche ni à Docker ni aux paquets installés
  # (évite de redémarrer le démon et de couper les conteneurs en place)
  echo "==> Docker déjà installé : installation et mise à jour du système ignorées"
  apt-get install -y --no-upgrade ca-certificates curl git ufw
else
  echo "==> Mise à jour du système"
  apt-get update
  apt-get -y upgrade
  apt-get install -y ca-certificates curl gnupg git ufw

  echo "==> Installation de Docker Engine et Docker Compose"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

if [[ "$TARGET_USER" != "root" ]]; then
  usermod -aG docker "$TARGET_USER"
  echo "    $TARGET_USER ajouté au groupe docker (reconnexion SSH nécessaire)"
fi

echo "==> Paramètres noyau pour SonarQube"
cat > /etc/sysctl.d/99-sonarqube.conf <<'EOF'
vm.max_map_count=524288
fs.file-max=131072
EOF
sysctl --system > /dev/null

echo "==> Pare-feu (mode $MODE)"
# Ouvre le(s) port(s) SSH réellement configurés pour ne pas perdre l'accès
SSH_PORTS="$(sshd -T 2>/dev/null | awk '/^port /{print $2}' | sort -u)"
for PORT in ${SSH_PORTS:-22}; do
  ufw allow "${PORT}/tcp" comment "SSH"
done
if [[ "$MODE" == "vm" ]]; then
  ufw allow 8080/tcp comment "Jenkins"
  ufw allow 9000/tcp comment "SonarQube"
fi
# NB : Docker contourne UFW pour les ports publiés. En mode VPS, la protection
# repose sur BIND_ADDRESS=127.0.0.1 (cf. start-lab.sh --vps).
ufw --force enable

echo
echo "VM prête :"
docker --version
docker compose version
echo "vm.max_map_count = $(sysctl -n vm.max_map_count)"
echo
if [[ "$MODE" == "vps" ]]; then
  echo "Étape suivante : se reconnecter en SSH puis lancer ./scripts/start-lab.sh --vps"
else
  echo "Étape suivante : se reconnecter en SSH puis lancer ./scripts/start-lab.sh"
fi
