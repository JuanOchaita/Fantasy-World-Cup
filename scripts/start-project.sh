#!/bin/bash
# FANTASY WORLD CUP - START SCRIPT (FULL PLATFORM)
set -e
cd "$(dirname "$0")/.."

echo "--- LEVANTANDO PLATAFORMA COMPLETA (DOCKER) ---"
# Levantamos todo el stack: API, DB, Redis, ES, y Frontend
docker compose up --build -d

echo "Esperando que los servicios nucleo esten saludables..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' db-lab-postgres)" == "healthy" ]; do printf "."; sleep 2; done
until [ "$(docker inspect -f '{{.State.Health.Status}}' db-lab-redis)" == "healthy" ]; do printf "."; sleep 2; done
until [ "$(docker inspect -f '{{.State.Health.Status}}' search-lab-elasticsearch)" == "healthy" ]; do printf "."; sleep 2; done

echo -e "\n-----------------------------------------------------"
echo "✅ PLATAFORMA INICIADA EXITOSAMENTE"
echo "-----------------------------------------------------"
echo "🌐 FRONTEND PRINCIPAL: http://localhost:5173"
echo "⚙️  BACKEND API (Go):  http://localhost:8080/api/v1"
echo "🔍 SEARCH (Redis AC): http://localhost:8081"
echo "👤 PLAYER INFO:       http://localhost:8082"
echo "⚡ ELASTICSEARCH:     http://localhost:8083"
echo "-----------------------------------------------------"
echo "Logs de la API: docker logs -f fantasy-world-cup-api"
echo "-----------------------------------------------------"
