# Guía de Integración: Equipo de Search DB

### 1. Fuente de Datos
La base de datos primaria es **PostgreSQL**. Debes indexar los datos de la tabla `players`.
- **Campos Clave**: `player_id`, `short_name`, `long_name`, `nationality_name`, `overall`, `club_name`.

### 2. Punto de Conexión en el Backend
Actualmente, el Backend expone:
- `GET /api/v1/players?q=nombre`: Utiliza un `ILIKE` en SQL.
- **Tu Objetivo**: Reemplazar la lógica en `internal/service/player_service.go` (función `Search`) para que consulte a tu motor de búsqueda en lugar de a Postgres.
