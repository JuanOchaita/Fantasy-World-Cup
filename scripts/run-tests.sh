#!/bin/bash

# FANTASY WORLD CUP - TEST RUNNER SCRIPT
set -e

# Asegurar que estamos en el root
cd "$(dirname "$0")/.."

export PATH=$HOME/go_dist/go/bin:$PATH

echo "Ejecutando pruebas de Go..."
go test -v ./...
