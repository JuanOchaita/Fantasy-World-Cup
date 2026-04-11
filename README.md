# Fantasy World Cup 2026 - Backend Go

Plataforma de Fantasy Football de alto rendimiento para el Mundial 2026, construida con Go, PostgreSQL 18 y Redis.

## Inicio Rápido

El proyecto está completamente automatizado. Para levantar la infraestructura (Base de Datos + Redis) y el Servidor Go, simplemente ejecuta:

```bash
./scripts/start-project.sh
```

Una vez iniciado:
- **API**: `http://localhost:8080/api/v1`
- **Frontend de Prueba**: `http://localhost:8080/web`
- **Salud del Sistema**: `http://localhost:8080/health`

## Arquitectura del Sistema

El proyecto sigue una arquitectura de **n-capas (N-tier)** para asegurar escalabilidad y separación de responsabilidades:

- **Capa de Repositorio (`internal/repository`)**: Acceso a datos tipo-seguro generado con `sqlc`.
- **Capa de Servicio (`internal/service`)**: Lógica de negocio (Validación de presupuesto, cálculo de puntos, hashing).
- **Capa de Handler (`internal/handler`)**: Controladores Gin que gestionan las peticiones HTTP.
- **Capa de Middleware (`internal/middleware`)**: Seguridad y autenticación JWT.
- **Infraestructura**:
    - **PostgreSQL 18**: Almacén persistente para usuarios, jugadores y escuadras.
    - **Redis 7**: Gestión de sesiones persistentes y Leaderboard global (Sorted Sets).

## Scripts de Automatización

Todos los scripts se encuentran en la carpeta `/scripts`:

- `start-project.sh`: Limpia procesos antiguos, levanta Docker, compila y arranca el servidor.
- `stop-project.sh`: Detiene el servidor Go y la infraestructura Docker de forma limpia.
- `run-tests.sh`: Ejecuta la suite de pruebas unitarias y de integración de Go.

## Endpoints Principales (API v1)

### Autenticación
- `POST /auth/register`: Registro de nuevos usuarios.
- `POST /auth/login`: Obtención de Access y Refresh Tokens.

### Jugadores (Protegido)
- `GET /players?q=nombre`: Buscador de jugadores con cálculo de precio fantasy en tiempo real.

### Escuadras (Protegido)
- `POST /squad`: Inicializa la escuadra del usuario.
- `GET /squad`: Obtiene el detalle de la escuadra y sus 11 jugadores.
- `POST /squad/players`: Añade un jugador validando presupuesto ($100M) y límite por nación (máximo 3).

### Puntuación y Ranking
- `GET /leaderboard`: Ranking global obtenido desde Redis (Público).
- `POST /admin/results`: Registro masivo de resultados y actualización de puntos (Admin).

## Estructura de Archivos
```text
├── cmd/server/main.go   # Punto de entrada
├── database/            # Esquema SQL, Queries y Datos (CSV)
├── frontend/            # Cliente web de pruebas (HTML/JS)
├── internal/            # Lógica central del sistema
├── pkg/                 # Utilidades (Conexión DB)
├── scripts/             # Automatización de tareas
└── docker-compose.yml   # Orquestación de infraestructura
```
