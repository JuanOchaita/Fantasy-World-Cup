#!/bin/bash
# FANTASY WORLD CUP - PORTABLE TEST RUNNER (FULL STACK)
set -e
cd "$(dirname "$0")/.."

echo "--- 1. PRUEBAS UNITARIAS (BACKEND) ---"
docker run --rm -v "$(pwd):/app" -w /app golang:1.25-alpine go test -v ./internal/service/... ./internal/middleware/...

echo -e "\n--- 2. VERIFICACION DE INFRAESTRUCTURA ---"

check_service() {
    local name=$1
    local url=$2
    local expected=$3
    printf "Verificando $name... "
    if curl -s "$url" | grep -q "$expected"; then
        echo "OK"
    else
        echo "FALLÓ"
        return 1
    fi
}

# Verificamos conectividad de todos los módulos
check_service "API Core (Go)" "http://127.0.0.1:8080/health" "ok"
check_service "Elasticsearch" "http://127.0.0.1:9200" "cluster_name"
check_service "Redis AC API" "http://127.0.0.1:8081" "" # Verifica que el puerto responda
check_service "Frontend UI" "http://127.0.0.1:5173" "html"

echo -e "\n--- 3. INTEGRIDAD DE DATOS ---"
USER_COUNT=$(docker exec db-lab-postgres psql -U admin -d labdb -t -c "SELECT count(*) FROM users;" | xargs)
echo "Usuarios en Base de Datos: $USER_COUNT"

if [ "$USER_COUNT" -gt 0 ]; then
    echo "Integridad: Datos presentes."
else
    echo " Aviso: Base de datos vacía. Ejecuta 'make data'."
fi

echo -e "\nTODAS LAS VERIFICACIONES COMPLETADAS."
