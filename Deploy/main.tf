resource "helm_release" "upstat-release" {
  name  = "upstat"
  chart = "./Chart"
}
