#!/usr/bin/env bash
# =============================================================
# Préparation de la VM Ubuntu Server 24.04 du lab CI
#   - mise à jour du système
#   - Docker Engine + plugin Compose (dépôt officiel Docker)
#   - paramètres noyau requis par SonarQube (Elasticsearch)
#   - pare-feu (SSH, Jenkins, SonarQube)
#
# Usage : sudo ./scripts/setup-vm.sh
# =============================================================
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Ce script doit être lancé avec sudo." >&2
  exit 1
fi

TARGET_USER="${SUDO_USER:-root}"

echo "==> Mise à jour du système"
export DEBIAN_FRONTEND=noninteractive
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

echo "==> Pare-feu"
ufw allow OpenSSH
ufw allow 8080/tcp comment "Jenkins"
ufw allow 9000/tcp comment "SonarQube"
ufw --force enable

echo
echo "VM prête :"
docker --version
docker compose version
echo "vm.max_map_count = $(sysctl -n vm.max_map_count)"
echo
echo "Étape suivante : se reconnecter en SSH puis lancer ./scripts/start-lab.sh"
