# =============================================================
# Providers Terraform
#
# Environnement : VMware Workstation (sans ESXi / vCenter).
# Le provider vSphere ne peut pas piloter Workstation : la VM est
# créée manuellement, et Terraform gère les ressources réellement
# disponibles (cf. README) :
#   - vérification de la VM par SSH (terraform_data + remote-exec)
#   - génération de l'inventaire Ansible (provider local)
# =============================================================
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.6"
    }
  }
}

provider "local" {}
