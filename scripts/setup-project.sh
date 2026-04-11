#!/bin/bash
# FANTASY WORLD CUP - SETUP SCRIPT
set -e

# Asegurar que estamos en el root
cd "$(dirname "$0")/.."

echo "--- CONFIGURACIÓN INICIAL ---"

# 1. Crear estructura de carpetas necesaria
echo "Creando estructura de directorios..."
mkdir -p cmd/server internal/handler internal/repository internal/service internal/middleware pkg/utils

# 2. Crear archivo .env si no existe
if [ ! -f .env ]; then
    echo "Generando archivo .env desde .env.example..."
    cp .env.example .env
else
    echo "Archivo .env ya existe, saltando..."
fi

# 3. Descargar y limpiar módulos de Go
echo "Sincronizando dependencias de Go..."
go mod tidy

echo "--- SETUP COMPLETADO ---"
echo "Ahora puedes ejecutar ./scripts/start-project.sh"
