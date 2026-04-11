# Guía de Integración: Equipo de UI/UX (Frontend)

Tu misión es transformar estas APIs en una experiencia visual atractiva con temática del Mundial 2026.

### 1. Detalles de Conexión
- **Base URL**: `http://localhost:8080/api/v1`
- **CORS**: Ya está habilitado para todos los orígenes en el Backend.
- **Autenticación**: Todas las rutas protegidas requieren el header `Authorization: Bearer <JWT>`.

### 2. Flujo de Usuario y Endpoints
1. **Auth**: `POST /auth/register` y `POST /auth/login`. Guarda el `access_token` en `localStorage` o `cookies`.
2. **Escuadra**:
   - `POST /squad`: Debes llamar a esto la primera vez que el usuario entre al "Squad Builder" para inicializar su equipo.
   - `GET /squad`: Para pintar los 11 jugadores y el presupuesto restante.
   - `PATCH /squad/formation`: Cuando el usuario cambie su formación (ej. de 4-4-2 a 4-3-3).
3. **Buscador**: `GET /players?q=...`. Implementa un "debouncing" en el input para no saturar la API.
