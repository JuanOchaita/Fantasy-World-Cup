# Guía de Integración: Equipo de Dashboard DB

Tu misión es gestionar el ranking global y la persistencia de sesiones utilizando **Redis**.

### 1. Gestión del Leaderboard (Sorted Sets)
El Backend ya sincroniza los puntos de las escuadras con Redis; aunque creo que lo puede hacer mejor 
- **Key**: `global_leaderboard` (Tipo: Sorted Set).
- **Lógica de Grabación**: El Backend ejecuta `ZADD` cada vez que se procesa un resultado de partido.
- **Tu Objetivo**: Optimizar la lectura del ranking y, opcionalmente, implementar lógica de "Rango del Usuario" (usando `ZREVRANK`) para mostrar la posición exacta del jugador en el Dashboard.

### 2. Sesiones y Seguridad
- **Refresh Tokens**: Se almacenan en Redis con una duración de 1 mes.
- **Blacklist**: Debes implementar (o colaborar con el Backend) una lista de bloqueo para JWTs invalidados tras un Logout.

### 3. Detalle Individual del Usuario (Performance)
Para ganar puntos en UX, el usuario debe ver su puesto exacto aunque no esté en el Top 10.
- **Endpoint**: `GET /api/v1/leaderboard/me` (Protegido).
- **Lógica en Redis**: Se utiliza `ZREVRANK` para obtener la posición y `ZSCORE` para los puntos totales.
- **Formato de Miembro**: El miembro en Redis se guarda como `username|squad_name`.

### 4. Funciones Relacionadas
- `internal/service/scoring_service.go`: Métodos `SyncLeaderboardToRedis` y `GetUserRank`.
- `internal/service/auth_service.go`: Gestión de tokens en Redis.
