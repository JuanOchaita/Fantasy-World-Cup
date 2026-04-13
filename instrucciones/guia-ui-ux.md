# Guía de Integración: Equipo de UI/UX (Frontend)

Tu misión es transformar estas APIs en una experiencia visual atractiva con temática del Mundial 2026.

### 1. Detalles de Conexión
- **Base URL**: `http://localhost:8080/api/v1`
- **CORS**: Habilitado para todos los orígenes.
- **Autenticación**: Header `Authorization: Bearer <JWT>`.

### 2. Ciclo de Vida de la Sesión (F1)
El sistema utiliza una estrategia de **Doble Token** para maximizar la seguridad sin molestar al usuario:

| Token | Duración | Propósito | Almacenamiento Sugerido |
| :--- | :--- | :--- | :--- |
| **Access Token** | 15 Minutos | Autorizar peticiones (Header Auth) | Memoria (Variable de JS) |
| **Refresh Token** | 1 Mes | Obtener nuevos Access Tokens | LocalStorage o Cookie Segura |

#### Flujo de Renovación Automática:
1. **Login**: Recibes ambos tokens. Guardas el `access` en memoria y el `refresh` en almacenamiento persistente.
2. **Uso Normal**: Envías el `access` en cada petición.
3. **Expiración (15 min)**: Si una petición devuelve `401 Unauthorized`, el Frontend debe:
   - Llamar a `POST /auth/refresh` enviando el `{ "refresh_token": "..." }`.
   - Si es exitoso, recibirás un nuevo par de tokens. Actualiza tu almacenamiento y reintenta la petición original.
   - Si falla (pasó más de 1 mes), redirigir al usuario al Login.

### 3. Endpoints de Autenticación
- **Registro**: `POST /auth/register` -> `{ username, email, password }`
- **Login**: `POST /auth/login` -> `{ email, password }`
- **Refresco**: `POST /auth/refresh` -> `{ refresh_token }`

### 4. Flujo de Usuario y Endpoints Funcionales

#### Dashboard y Ranking
- **`GET /leaderboard`**: Top global (Redis).
- **`GET /leaderboard/me`**: (Protegido) Posición y puntos exactos del usuario.

#### Gestión de Escuadra
- **`POST /squad`**: Inicializa equipo.
- **`GET /squad`**: Detalle completo.
- **`POST /squad/players`**: Añade jugador.
- **`PATCH /squad/formation`**: Cambia táctica.

#### Búsqueda
- **`GET /players?q=nombre`**: Buscador con autocompletado.

### 5. Panel de Administración (F4.1)
- **`POST /admin/results`**: Registra resultados de partidos para actualizar puntos globalmente.

### 6. Requerimientos de UX
- **Debouncing**: No satures el buscador; espera a que el usuario deje de escribir.
- **Feedback**: Mostrar spinners durante el proceso de refresco de token.
- **Validación**: Bloquear acciones si el presupuesto se excede.
