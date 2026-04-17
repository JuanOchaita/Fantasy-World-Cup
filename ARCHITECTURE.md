# Arquitectura Técnica - Fantasy World Cup 2026

Este documento describe la arquitectura de software, las decisiones de base de datos y las estrategias de optimización implementadas para garantizar un rendimiento extremo y alta disponibilidad.

## Diseño de N-Capas (N-Tier Architecture)

El sistema está organizado en capas lógicas para asegurar la separación de responsabilidades y la facilidad de mantenimiento:

1.  Capa de Presentación (Frontend): React/Vite que consume las APIs de forma asíncrona.
2.  Capa de Aplicación (API Core): Backend en Go (Gin) que implementa las reglas de negocio (validaciones de presupuesto, formaciones, etc.).
3.  Capa de Persistencia (Políglota): Uso coordinado de múltiples motores de datos según su especialización.

## Decisiones de Base de Datos

Hemos optado por una Persistencia Políglota para resolver los diferentes retos técnicos del proyecto:

### 1. PostgreSQL 18 (Base de Datos Primaria)
*   Uso: Datos maestros de jugadores, usuarios y escuadras.
*   Por qué: Necesitamos integridad referencial fuerte (ACID). Las escuadras dependen estrictamente de los IDs de los jugadores y usuarios. PostgreSQL 18 ofrece un rendimiento óptimo en queries relacionales complejas y soporte nativo para tipos de datos avanzados.

### 2. Redis 7 (Cache y Real-Time Leaderboard)
*   Uso: Sesiones persistentes (Refresh Tokens) y Ranking Global.
*   Por qué: 
    *   Leaderboard: El uso de Sorted Sets (ZSET) permite que el cálculo de la posición mundial sea O(log(N)), permitiendo que miles de usuarios vean su puesto instantáneamente sin saturar a Postgres con COUNT y ORDER BY.
    *   Sesiones: La velocidad de lectura de Redis garantiza que la validación de tokens en el middleware sea casi instantánea.

### 3. Elasticsearch 8 (Búsqueda Avanzada)
*   Uso: Motor de búsqueda de jugadores.
*   Por qué: Implementar búsqueda difusa (fuzzy matching) y autocompletado en 18,000+ registros es costoso en SQL tradicional. Elasticsearch permite búsquedas fonéticas y por relevancia con latencias inferiores a 50ms.

## Estrategia de Caching y Sincronización

El sistema implementa una sincronización proactiva:

-   Write-Through (Simulado): Cuando el administrador registra un resultado de partido, el Backend actualiza Postgres y simultáneamente refresca el Sorted Set en Redis.
-   Auto-Sync al inicio: Al arrancar el servidor (o mediante make build), se dispara una tarea de fondo que sincroniza el estado de la DB SQL con Redis para garantizar que el cache nunca esté obsoleto tras un reinicio del stack.

## Alternativas Consideradas

| Alternativa | Razón del Rechazo |
| :--- | :--- |
| MongoDB (NoSQL) | Las relaciones entre jugadores y escuadras son puramente relacionales; el uso de NoSQL habría introducido duplicidad de datos y riesgos de inconsistencia en el presupuesto. |
| Postgres FTS (Búsqueda) | Aunque Postgres tiene Full Text Search, Elasticsearch escala mejor para búsquedas simultáneas masivas y ofrece una configuración de "relevancia" más flexible para UI/UX. |
| JWT Stateless total | Se rechazó para cumplir con el requerimiento F1.5 (Sesiones de 1 mes). Al usar Redis para guardar Refresh Tokens, podemos invalidar sesiones inmediatamente (Logout) sin esperar a que el token expire. |

## Portabilidad
Toda la infraestructura está orquestada mediante **Docker Compose**, lo que elimina el problema de "funciona en mi máquina" y permite desplegar el ecosistema completo con un solo comando (`make build`).
