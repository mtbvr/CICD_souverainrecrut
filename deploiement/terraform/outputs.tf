output "ansible_inventory" {
  description = "Inventaire Ansible généré"
  value       = abspath(local_file.ansible_inventory.filename)
}

output "ssh_command" {
  description = "Commande de connexion SSH à la VM"
  value       = "ssh -i ${var.ssh_private_key_path} ${var.ssh_user}@${var.vm_ip}"
}

output "ansible_command" {
  description = "Commande de préparation du serveur"
  value       = "cd ../ansible && ansible-playbook -i inventory.ini playbook.yml"
}

output "api_url" {
  description = "URL de santé de l'API une fois déployée"
  value       = "http://${var.vm_ip}:${var.api_port}/v1/health"
}

output "gitlab_variables" {
  description = "Valeurs non secrètes à reporter dans les variables CI/CD GitLab"
  value = {
    DEPLOY_HOST = var.vm_ip
    DEPLOY_USER = var.ssh_user
    DEPLOY_DIR  = var.deploy_dir
    API_PORT    = var.api_port
  }
}
