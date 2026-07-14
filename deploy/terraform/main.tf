# Deploys the repo's Helm chart (deploy/helm) — one chart deploys all services.
resource "helm_release" "upstat" {
  name             = "upstat"
  namespace        = var.namespace
  create_namespace = true
  chart            = "${path.module}/../helm"
  values           = var.chart_values
}
