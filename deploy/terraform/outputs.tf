output "namespace" {
  description = "Namespace the release was installed into."
  value       = helm_release.upstat.namespace
}

output "release_status" {
  description = "Status of the Helm release."
  value       = helm_release.upstat.status
}
