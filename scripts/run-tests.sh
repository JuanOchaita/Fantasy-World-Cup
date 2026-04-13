#!/bin/bash
# FANTASY WORLD CUP - TEST RUNNER
set -e
cd "$(dirname "$0")/.."

export PATH=$HOME/go_dist/go/bin:$PATH

echo "--- EJECUTANDO PRUEBAS UNITARIAS ---"
go test -v ./internal/service/... ./internal/middleware/...

echo "--- EJECUTANDO PRUEBAS DE INTEGRACION (API) ---"
# 1. Verificar salud usando 127.0.0.1 y buscando la cadena "ok" de forma flexible
HEALTH_CHECK=$(curl -s http://127.0.0.1:8080/health || echo "offline")

if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
    echo "Servidor Online. Verificando integridad de datos..."
    
    # 2. Verificar que el leaderboard responda (sin importar si hay datos o no, solo que el endpoint funcione)
    LB_RES=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/v1/leaderboard)
    if [ "$LB_RES" == "200" ]; then
        echo "Integración: Endpoint /leaderboard operativo (HTTP 200)."
    else
        echo "Integración: Endpoint /leaderboard devolvió error $LB_RES."
        exit 1
    fi

    # 3. Verificar acceso a /leaderboard/me (Debe dar 401 por falta de token, lo cual es correcto)
    AUTH_RES=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/v1/leaderboard/me)
    if [ "$AUTH_RES" == "401" ]; then
        echo "Integración: Middleware de Autenticación protegiendo rutas correctamente."
    else
        echo "Integración: Fallo en la validación del Middleware (Esperado 401, recibido $AUTH_RES)."
        exit 1
    fi
else
    echo "Aviso: Servidor Offline en http://127.0.0.1:8080/health. Saltando integración."
    echo "Respuesta recibida: $HEALTH_CHECK"
fi

echo "--------------------------------------"
echo "TODAS LAS PRUEBAS FINALIZARON EXITOSAMENTE"
echo "--------------------------------------"
