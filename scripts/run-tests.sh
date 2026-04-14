#!/bin/bash
# FANTASY WORLD CUP - PORTABLE TEST RUNNER
set -e
cd "$(dirname "$0")/.."

echo "--- EJECUTANDO PRUEBAS UNITARIAS (VIA DOCKER) ---"
# Usamos una imagen ligera de Go para correr los tests sobre el volumen actual
docker run --rm \
    -v "$(pwd):/app" \
    -w /app \
    golang:1.25-alpine \
    go test -v ./internal/service/... ./internal/middleware/...

echo "--- VERIFICANDO INTEGRACION DE API ---"
# Verificamos si la API está respondiendo (asumiendo que se corrió make start antes)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/health || echo "000")

if [ "$STATUS" == "200" ]; then
    echo "✅ Integración: El servidor responde correctamente (HTTP 200)."
else
    echo "⚠️  Aviso: El servidor no responde. Ejecuta 'make start' primero para pruebas de integración."
fi

echo "✅ Verificación finalizada."
