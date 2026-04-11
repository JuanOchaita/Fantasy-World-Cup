#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "--- CONFIGURANDO ENTORNO ---"
if [ ! -f .env ]; then
    cp .env.example .env
    sed -i 's/localhost/127.0.0.1/g' .env
fi

echo "✅ Configuración finalizada."
