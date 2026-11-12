variable "vm_name" {
  description = "Nom logique du serveur de déploiement (inventaire Ansible)"
  type        = string
  default     = "souverainrecrut-vm"
}

variable "vm_ip" {
  description = "Adresse IP de la VM Ubuntu (ip -4 addr show sur la VM)"
  type        = string

  validation {
    condition     = can(regex("^((25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])$", var.vm_ip))
    error_message = "vm_ip doit être une adresse IPv4 valide."
  }
}

variable "ssh_user" {
  description = "Utilisateur SSH de déploiement (sudoer) sur la VM"
  type        = string
  default     = "deploy"
}

variable "ssh_private_key_path" {
  description = "Chemin de la clé privée SSH utilisée pour se connecter à la VM"
  type        = string
  default     = "~/.ssh/souverainrecrut_deploy"
}

variable "api_port" {
  description = "Port d'exposition de l'API sur la VM"
  type        = number
  default     = 4000
}

variable "deploy_dir" {
  description = "Répertoire de déploiement sur la VM"
  type        = string
  default     = "/opt/souverainrecrut"
}

variable "vm_specs" {
  description = "Caractéristiques attendues de la VM (documentation et contrôle)"
  type = object({
    os      = string
    vcpu    = number
    ram_mb  = number
    disk_gb = number
    network = string
  })
  default = {
    os      = "Ubuntu Server 24.04 LTS"
    vcpu    = 2
    ram_mb  = 4096
    disk_gb = 30
    network = "NAT"
  }
}
