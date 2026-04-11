#!/bin/bash

# FANTASY WORLD CUP - STOP PROJECT SCRIPT
set -e

# Asegurar que estamos en el root
cd "$(dirname "$0")/.."

echo "Deteniendo servidor Go (puerto 8080)..."
fuser -k 8080/tcp 2>/dev/null || true

echo "Deteniendo infraestructura Docker..."
docker compose down -v

echo "Proyecto detenido correctamente."
