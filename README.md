# Fantasy World Cup 2026 - Backend Go

Plataforma de Fantasy Football de alto rendimiento para el Mundial 2026, construida con Go, PostgreSQL 18 y Redis.

## Instalación
Para comenzar rápidamente, consulta la [Guía de Instalación (INSTALL.md)](INSTALL.md).

## Arquitectura del Sistema

El backend sigue una arquitectura de **n-capas (N-tier)** para asegurar escalabilidad:

- **Capa de Repositorio (`internal/repository`)**: Acceso a datos tipo-seguro generado automáticamente por `sqlc`.
- **Capa de Servicio (`internal/service`)**: Contiene la lógica de negocio (validación de reglas, cálculo de puntos, gestión de escuadra).
- **Capa de Handler (`internal/handler`)**: Controladores Gin que exponen los endpoints REST y validan los DTOs de entrada.
- **Capa de Middleware (`internal/middleware`)**: Gestión de autenticación JWT y control de acceso.

## Integración con Otros Módulos

El backend actúa como el núcleo orquestador del ecosistema:

- **Búsqueda (Search DB)**: El endpoint `GET /players` está diseñado para delegar la búsqueda pesada a un servicio externo. *Punto de integración: `internal/service/player_service.go`*.
- **Dashboard y Leaderboards**: El sistema publica actualizaciones de puntaje hacia Redis. El módulo de Dashboard DB consume estos datos desde Redis para mostrar rankings en tiempo real. *Punto de integración: `internal/service/scoring_service.go`*.
- **Frontend (UI/UX)**: Comunicación vía API REST siguiendo el contrato definido en `frontend/app.js`.

## Estructura de Archivos
```text
├── Makefile             # Interfaz unificada de comandos
├── INSTALL.md           # Guía de instalación y replicación
├── cmd/server/main.go   # Punto de entrada (Configuración del servidor y rutas)
├── database/            # Esquema SQL, Queries (sqlc) y Datos (CSV)
├── Dockerfile           # Build multi-etapa contenedorizado
├── frontend/            # Cliente web de pruebas (Contrato de API)
├── internal/            # Lógica central (Handler, Middleware, Repo, Service)
├── pkg/                 # Utilidades compartidas (Conexión DB)
├── scripts/             # Scripts de soporte
└── docker-compose.yml   # Orquestación de infraestructura (Postgres, Redis)
```
