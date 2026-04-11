#!/bin/bash

# Script para automatizar el levantado de la base de datos
set -e

echo "Iniciando contenedores de la base de datos..."
docker compose -f Backend/SQL/docker-compose.yml up -d

echo "Esperando a que PostgreSQL este listo..."
until docker inspect -f '{{.State.Health.Status}}' db-lab-postgres | grep -q "healthy"; do
  printf "."
  sleep 2
done

echo -e "\nBase de datos lista y cargada."
echo "Conexion: postgresql://admin:admin@localhost:5433/labdb"
