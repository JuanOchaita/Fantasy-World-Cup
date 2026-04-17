#!/bin/bash
# FANTASY WORLD CUP - STOP SCRIPT
set -e
cd "$(dirname "$0")/.."

echo "--- DETENIENDO Y LIMPIANDO PLATAFORMA ---"
docker compose down -v
docker compose rm -f

echo "Todo el sistema ha sido eliminado y los volúmenes limpiados."
