# Guía de Instalación y Replicación (Quick Start)

Esta guía contiene los pasos técnicos necesarios para replicar la plataforma completa de Fantasy World Cup 2026 en cualquier máquina local.

## 1. Requisitos Previos
- Docker y Docker Compose (Versión moderna con soporte para buildx).
- Make (Opcional, pero altamente recomendado para la interfaz de comandos).

## 2. Instalación en un Solo Paso
Para configurar el entorno, generar el código necesario, descargar las imágenes de Docker, levantar los 8 contenedores del ecosistema y poblar la base de datos con 11 equipos de prueba, ejecuta:

```bash
make build
```

Este comando unifica secuencialmente:
1. Generación de archivos de configuración (.env, main.go).
2. Generación de código tipo-seguro (sqlc vía Docker).
3. Construcción y levantamiento de la infraestructura políglota.
4. Población de datos iniciales (Admin + 10 Usuarios simulados).

## 3. Comandos de Control Diario
Usa la interfaz de Makefile para gestionar el ciclo de vida del proyecto:

- **make start**: Inicia los contenedores que ya han sido construidos.
- **make pause**: Detiene la ejecución sin borrar datos ni contenedores (docker compose stop).
- **make stop**: Limpieza total; detiene contenedores y borra volúmenes de datos (Postgres, ES, Redis).
- **make data**: Limpia la base de datos y vuelve a registrar al administrador y los 10 usuarios de prueba.
- **make test**: Ejecuta las pruebas unitarias en un contenedor Go aislado y verifica la salud de los servicios locales.

## 4. Mapa de Servicios y Puertos
Una vez completado el "make build", podrás acceder a los servicios en las siguientes direcciones:

| Servicio | URL Local | Puerto |
| :--- | :--- | :--- |
| Frontend Principal (React) | http://localhost:5173 | 5173 |
| Backend API (Go/Gin) | http://localhost:8080/api/v1 | 8080 |
| Elasticsearch (API) | http://localhost:8083 | 8083 |
| Autocomplete (Redis) | http://localhost:8081 | 8081 |
| Player Info (Redis) | http://localhost:8082 | 8082 |
| PostgreSQL 18 | localhost (127.0.0.1) | 5433 |
| Redis 7 | localhost (127.0.0.1) | 6379 |
| Elasticsearch (Core) | localhost (127.0.0.1) | 9200 |

## 5. Solución de Problemas de Red (Linux/WSL)
Si Docker falla al intentar crear la red con un error de "iptables", reinicia el daemon de Docker:

```bash
sudo service docker restart
```
