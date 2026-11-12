# =============================================================
# Serveur de déploiement SouverainRecrut
# =============================================================

locals {
  ssh_private_key_path = pathexpand(var.ssh_private_key_path)
}

# -------------------------------------------------------------
# 1. Contrôle de la VM : joignable en SSH et conforme aux prérequis
#    (Ubuntu 24.04, sudo, python3 pour Ansible, ressources minimales).
#    Rejoué si l'IP, l'utilisateur ou les specs changent.
# -------------------------------------------------------------
resource "terraform_data" "vm_check" {
  triggers_replace = [var.vm_ip, var.ssh_user, var.vm_specs]

  connection {
    type        = "ssh"
    host        = var.vm_ip
    user        = var.ssh_user
    private_key = file(local.ssh_private_key_path)
    timeout     = "30s"
  }

  provisioner "remote-exec" {
    inline = [
      "set -e",
      "echo \"Hôte  : $(hostname)\"",
      ". /etc/os-release && echo \"OS    : $PRETTY_NAME\" && [ \"$VERSION_ID\" = \"24.04\" ]",
      "echo \"vCPU  : $(nproc)\" && [ $(nproc) -ge ${var.vm_specs.vcpu} ]",
      "MEM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo) && echo \"RAM   : $MEM Mo\" && [ $MEM -ge ${var.vm_specs.ram_mb - 512} ]",
      "echo \"Disque: $(df -h / | awk 'NR==2 {print $2}')\"",
      "command -v python3 > /dev/null && echo 'python3 : OK'",
      "sudo -n true && echo 'sudo sans mot de passe : OK'",
      "curl -fsS -o /dev/null https://download.docker.com && echo 'Accès Internet : OK'",
    ]
  }
}

# -------------------------------------------------------------
# 2. Inventaire Ansible généré à partir des variables
# -------------------------------------------------------------
resource "local_file" "ansible_inventory" {
  filename        = "${path.module}/../ansible/inventory.ini"
  file_permission = "0644"
  content = templatefile("${path.module}/templates/inventory.ini.tftpl", {
    vm_name              = var.vm_name
    vm_ip                = var.vm_ip
    ssh_user             = var.ssh_user
    ssh_private_key_path = var.ssh_private_key_path
    api_port             = var.api_port
    deploy_dir           = var.deploy_dir
  })

  depends_on = [terraform_data.vm_check]
}

# -------------------------------------------------------------
# 3. Fiche de l'environnement (valeurs à reporter dans GitLab)
# -------------------------------------------------------------
resource "local_file" "environment_summary" {
  filename        = "${path.module}/environment.md"
  file_permission = "0644"
  content = templatefile("${path.module}/templates/environment.md.tftpl", {
    vm_name    = var.vm_name
    vm_ip      = var.vm_ip
    ssh_user   = var.ssh_user
    api_port   = var.api_port
    deploy_dir = var.deploy_dir
    specs      = var.vm_specs
  })
}
