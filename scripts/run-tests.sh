#!/bin/bash

# FANTASY WORLD CUP - TEST RUNNER SCRIPT
set -e

# Asegurar que estamos en el root
cd "$(dirname "$0")/.."

export PATH=$HOME/go_dist/go/bin:$PATH

echo "Cargando entorno y ejecutando pruebas de Go..."
# Intentar cargar .env si existe para que los tests tengan acceso a DB_URL, etc.
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

go test -v ./...
