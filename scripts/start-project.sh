#!/bin/bash

# FANTASY WORLD CUP - START PROJECT SCRIPT
set -e

# Asegurar que estamos en el root
cd "$(dirname "$0")/.."

echo "--- LIMPIEZA ---"
# Matar procesos en el puerto 8080 y limpiar contenedores previos
fuser -k 8080/tcp 2>/dev/null || true
docker rm -f db-lab-postgres db-lab-redis 2>/dev/null || true

echo "--- INFRAESTRUCTURA ---"
# Levantar bases de datos
docker compose down -v
docker compose up -d

echo "Esperando que Postgres y Redis esten listos..."
# Verificación de salud basada en docker-compose.yml
until [ "$(docker inspect -f '{{.State.Health.Status}}' db-lab-postgres)" == "healthy" ]; do printf "."; sleep 2; done
until [ "$(docker inspect -f '{{.State.Health.Status}}' db-lab-redis)" == "healthy" ]; do printf "."; sleep 2; done
echo -e "\nInfraestructura lista."

echo "--- BACKEND (Go) ---"
# Asegurar que el entorno de Go esté en el PATH
export PATH=$HOME/go_dist/go/bin:$PATH

# Sincronizar dependencias antes de compilar
go mod tidy

# Compilar usando ruta relativa correcta para evitar error 'not in std'
go build -o server ./cmd/server/main.go

echo "Iniciando servidor..."
# El servidor usará la DB_URL definida en el .env
./server > server.log 2>&1 &
SERVER_PID=$!

echo "Verificando salud del servidor..."
sleep 5
# Verifica el endpoint definido en el router de Gin
HEALTH_CHECK=$(curl -s http://localhost:8080/health || echo "fail")

if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
  echo "--- PROYECTO LISTO ---"
  echo "Servidor Go corriendo (PID: $SERVER_PID)"
  echo "Frontend UI: http://localhost:8080/web"
  echo "API Base:    http://localhost:8080/api/v1"
else
  echo "--- ERROR: El servidor no respondio ---"
  echo "Revisa server.log para más detalles:"
  tail -n 20 server.log
  exit 1
fi
