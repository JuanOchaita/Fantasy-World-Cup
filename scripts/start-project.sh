#!/bin/bash

# FANTASY WORLD CUP - START SCRIPT
set -e
cd "$(dirname "$0")/.."

echo "--- LEVANTANDO INFRAESTRUCTURA ---"
docker compose up --build -d

echo "Esperando que Postgres y Redis esten listos..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' db-lab-postgres)" == "healthy" ]; do printf "."; sleep 2; done
until [ "$(docker inspect -f '{{.State.Health.Status}}' db-lab-redis)" == "healthy" ]; do printf "."; sleep 2; done

echo -e "\n✅ PROYECTO INICIADO"
echo "API Base: http://localhost:8080/api/v1"
echo "Frontend: http://localhost:8080/web"
