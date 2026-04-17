Aquí tienes el listado detallado de los **31 criterios de aceptación** divididos por las 5 áreas funcionales del proyecto:

### F1: Autenticación de Usuario y Sesiones Persistentes
* **F1.1**: Registro con nombre de usuario/email y contraseña; rechazo de duplicados con mensaje de error claro.
* **F1.2**: Inicio de sesión con credenciales válidas; error genérico para credenciales inválidas sin revelar qué campo falló.
* **F1.3**: Creación de token de sesión que persista al menos 1 mes sin requerir nuevo login al reabrir el sitio.
* **F1.4**: Rutas protegidas (squad builder, leaderboard, perfil) accesibles solo para usuarios autenticados; redirección al login para el resto.
* **F1.5**: Función de cierre de sesión que invalida el token de sesión.

### F2: Búsqueda de Jugadores con Autocompletado
* **F2.1**: Barra de búsqueda que muestra resultados en tiempo real después de escribir al menos 2 caracteres.
* **F2.2**: Coincidencia parcial y "fuzzy" por nombre de jugador; manejo adecuado de caracteres acentuados.
* **F2.3**: Filtros combinados (lógica AND) por nacionalidad, posición, club y rango de rating.
* **F2.4**: Visualización de info clave: nombre, foto, nacionalidad, club, posición, rating y precio fantasy.
* **F2.5**: Resultados paginados o con scroll infinito (no cargar los 18,000+ resultados a la vez).
* **F2.6**: Rendimiento de autocompletado percibido como instantáneo.

### F3: Ensamblaje de Escuadra (Squad Assembly)
* **F3.1**: Selección de formación (mínimo 3 opciones, ej. 4-3-3) que define los espacios posicionales.
* **F3.2**: Agregar jugadores desde la búsqueda a espacios válidos; bloqueo con mensaje si no hay espacio disponible.
* **F3.3**: Control de presupuesto: mostrar presupuesto restante y bloquear adiciones que excedan el límite.
* **F3.4**: Límite por país: máximo 3 jugadores de la misma selección nacional.
* **F3.5**: Eliminación de jugadores para liberar espacio y recuperar presupuesto.
* **F3.6**: Vista de escuadra con los 11 espacios, formación, costo total, presupuesto restante y puntos acumulados.
* **F3.7**: Persistencia en base de datos para recuperar la escuadra tras cerrar sesión.
* **F3.8**: Cambio de formación con manejo de incompatibilidades (advertencias o ajustes automáticos).

### F4: Puntuación y Tabla de Clasificación (Leaderboard)
* **F4.1**: Interfaz de administrador para ingresar resultados de partidos (Equipo A, Equipo B y marcador).
* **F4.2**: Cálculo automático de puntos por escuadra: +3 por victoria del jugador, +1 por empate, 0 por derrota.
* **F4.3**: Visualización clara de las reglas de puntuación en la plataforma.
* **F4.4**: Tabla de clasificación global ordenada por puntos totales con rango, usuario y puntos.
* **F4.5**: Actualización de la tabla tras ingresar cada resultado de partido.
* **F4.6**: Tabla paginada o con carga diferida capaz de manejar 500+ usuarios sin degradación.
* **F4.7**: Función para encontrar o resaltar la posición actual del usuario en el ranking.
* **F4.8**: Desglose de puntos: ver qué partidos y qué jugadores contribuyeron al puntaje total.

### F5: Interfaz de Usuario (UI)
* **F5.1**: Diseño visual consistente con temática de la Copa del Mundo 2026.
* **F5.2**: Diseño responsivo usable en escritorio y dispositivos móviles.
* **F5.3**: Navegación intuitiva entre búsqueda, escuadra y tabla de clasificación.
* **F5.4**: Manejo de estados de carga y mensajes de error (spinners, errores claros, estados vacíos).