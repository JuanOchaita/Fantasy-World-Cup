#!/bin/bash

# FANTASY WORLD CUP - START PROJECT SCRIPT
set -e

# Asegurar que estamos en el root
cd "$(dirname "$0")/.."

echo "--- LIMPIEZA ---"
fuser -k 8080/tcp 2>/dev/null || true
docker rm -f db-lab-postgres db-lab-redis 2>/dev/null || true

echo "--- INFRAESTRUCTURA ---"
docker compose down -v
docker compose up -d

echo "Esperando que Postgres y Redis esten listos..."
until docker inspect -f '{{.State.Health.Status}}' db-lab-postgres | grep -q "healthy"; do printf "."; sleep 2; done
until docker inspect -f '{{.State.Health.Status}}' db-lab-redis | grep -q "healthy"; do printf "."; sleep 2; done
echo -e "\nInfraestructura lista."

echo "--- BACKEND (Go) ---"
export PATH=$HOME/go_dist/go/bin:$PATH
go build -o server cmd/server/main.go

echo "Iniciando servidor..."
./server > server.log 2>&1 &
SERVER_PID=$!

echo "Verificando salud del servidor..."
sleep 5
HEALTH_CHECK=$(curl -s http://localhost:8080/health || echo "fail")

if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
  echo "--- PROYECTO LISTO ---"
  echo "Servidor Go (PID: $SERVER_PID)"
else
  echo "--- ERROR: El servidor no respondio ---"
  cat server.log
  exit 1
fi
