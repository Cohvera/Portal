#!/bin/sh
set -eu

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and configure PORTAL_DOMAIN and POSTGRES_PASSWORD."
  exit 1
fi

echo "Pulling images and building Cohvera Portal..."
docker compose build --pull

echo "Starting database, migration, API, web and HTTPS proxy..."
docker compose up -d

echo "Container status:"
docker compose ps

echo "Deployment started. Caddy will provision/renew TLS automatically when DNS and ports 80/443 are reachable."
