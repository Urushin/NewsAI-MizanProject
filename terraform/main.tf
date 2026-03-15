provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_container_cluster" "primary" {
  name     = "newsai-cluster"
  location = var.region

  initial_node_count = 1

  node_config {
    machine_type = "e2-medium"
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
}

variable "project_id" {
  description = "The GCP project ID"
  default     = "newsai-project"
}

variable "region" {
  description = "The GCP region"
  default     = "europe-west1-b"
}
