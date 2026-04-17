Este es el resumen ejecutivo del proyecto **Fantasy World Cup 2026**, diseñado para que todos los equipos comprendan su rol y cómo sus piezas se ensamblan en el producto final.

### 1. El Objetivo del Proyecto
[cite_start]El propósito es construir una plataforma de *Fantasy Football* para el Mundial 2026 que sea **extremadamente rápida y escalable**[cite: 3, 8, 36]. [cite_start]La meta no es solo que funcione, sino que gane la competición en vivo basándose en la **velocidad de respuesta** y la **experiencia de usuario**[cite: 131, 139, 156].

---

### 2. Los 5 Pilares Funcionales (El "Qué")
[cite_start]El éxito se mide por el cumplimiento de **31 criterios de aceptación** repartidos en estas áreas[cite: 83]:

* [cite_start]**Autenticación y Sesiones (F1):** Registro, login y sesiones que duren 1 mes sin desconectar al usuario[cite: 63, 64].
* [cite_start]**Búsqueda de Jugadores (F2):** Un buscador con autocompletado "instantáneo" y filtros avanzados sobre una base de 18,000 jugadores[cite: 65, 66].
* **Armado de Escuadras (F3):** El corazón del juego. [cite_start]Validar formaciones, presupuesto de $100M y un máximo de 3 jugadores por país[cite: 67, 72].
* [cite_start]**Puntuación y Leaderboard (F4):** Cálculo de puntos en tiempo real tras resultados de partidos y un ranking global que soporte miles de usuarios[cite: 73, 74].
* [cite_start]**Interfaz de Usuario (F5):** Un diseño temático del Mundial, responsivo y con navegación fluida[cite: 81, 82].

---

### 3. La Arquitectura Técnica (El "Cómo")
[cite_start]El sistema debe ser una **plataforma full-stack** con múltiples arquitecturas de bases de datos coordinadas[cite: 4]:

* [cite_start]**Base de Datos Primaria:** Relacional (PostgreSQL) para datos críticos como usuarios y escuadras[cite: 86, 110].
* [cite_start]**Base de Datos NoSQL:** Al menos una base de datos especializada (Documentos, Key-Value, Búsqueda, etc.) para optimizar tareas específicas[cite: 87, 93, 111].
* [cite_start]**Capa de Caché:** Obligatoria para rutas críticas como el ranking o las sesiones[cite: 90, 112].
* [cite_start]**Orquestación:** Todo debe levantarse con un solo comando: `docker compose up`[cite: 114, 125].

---

### 4. Roles y Sinergia de los Equipos (El "Gran Esquema")

Para que el proyecto fluya, los cuatro equipos dependen entre sí de la siguiente manera:

* **Equipo Backend & SQL DB:** Es el "sistema nervioso". [cite_start]Implementa las reglas del negocio (validaciones de presupuesto, cálculo de puntos) y gestiona la base de datos central[cite: 122]. Provee las APIs que consumen los demás equipos.
* **Equipo Search DB:** Se especializa en la **velocidad de búsqueda (F2)**. [cite_start]Su misión es que el buscador devuelva resultados en milisegundos usando tecnologías como Elasticsearch o Meilisearch para ganar puntos en la competencia de velocidad[cite: 93, 144].
* **Equipo Dashboard DB:** Se enfoca en el **rendimiento del ranking y sesiones (F1 y F4)**. [cite_start]Utiliza herramientas como Redis para que el leaderboard cargue al instante y maneja la persistencia de sesiones de larga duración[cite: 93, 144].
* **Equipo Frontend UI/UX:** Es la "cara" del proyecto. [cite_start]Transforma las APIs de los otros equipos en una experiencia visual atractiva (F5), asegurando que el flujo sea intuitivo y rápido en móviles y escritorio[cite: 82, 147].

---

### 5. Evaluación Final
[cite_start]El puntaje se divide en dos partes iguales[cite: 129]:
1.  [cite_start]**Entrega del Proyecto (50%):** Calidad del código, justificación de la arquitectura y cumplimiento de los 31 criterios[cite: 130, 134].
2.  [cite_start]**Competición en Vivo (50%):** Pruebas objetivas de velocidad (Autocomplete y carga de Leaderboard) y juicio subjetivo de diseño UI/UX[cite: 131, 135, 139].

[cite_start]En resumen: **Backend** pone las reglas, **Search** y **Dashboard** ponen la velocidad, y **UI/UX** pone la experiencia de usuario[cite: 93, 134].