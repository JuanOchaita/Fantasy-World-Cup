# Fantasy World Cup 2026 - Plataforma Políglota

Ecosistema completo de Fantasy Football escalable, con búsqueda instantánea y procesamiento en tiempo real.

## 🚀 Inicio Rápido (Un solo comando)

Gracias a la dockerización total, puedes levantar la plataforma completa (Frontend, Backend y Servicios de Búsqueda) con:

```bash
make build
```

*(Esto ejecutará la configuración del entorno y el levantamiento de Docker)*.

## 🏗️ Arquitectura Políglota

La plataforma utiliza múltiples motores para maximizar el rendimiento:

- **Core Backend (Go/Gin)**: Gestión de reglas de negocio, usuarios y escuadras.
- **Persistencia (PostgreSQL 18)**: Datos maestros de jugadores y usuarios.
- **Cache & Leaderboard (Redis 7)**: Ranking mundial instantáneo y sesiones.
- **Búsqueda Avanzada (Elasticsearch 8)**: Motor de búsqueda de texto completo para jugadores.
- **Búsqueda Rápida (Redis AC)**: Microservicio de autocompletado ultra-rápido.
- **Frontend Moderno (React/Vite)**: Interfaz de usuario de última generación.

## 🔗 Mapa de Puertos y Servicios

| Servicio | URL Local | Descripción |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:5173](http://localhost:5173) | UI Principal de la plataforma. |
| **Backend API** | [http://localhost:8080](http://localhost:8080/api/v1) | API Core del sistema. |
| **Search (ES)** | [http://localhost:8083](http://localhost:8083) | Búsqueda vía Elasticsearch. |
| **Autocomplete**| [http://localhost:8081](http://localhost:8081) | Búsqueda vía Redis Sorted Sets. |
| **Player Info** | [http://localhost:8082](http://localhost:8082) | Información extendida vía Redis. |

## 🛠️ Herramientas de Control

Usa los comandos `make` para gestionar el ciclo de vida:
- `make setup`: Prepara archivos `.env` y modelos de base de datos.
- `make start`: Levanta todo el ecosistema Docker.
- `make stop`: Apaga y limpia la infraestructura.
- `make data`: Pobla el sistema con datos de prueba reales.
- `make test`: Ejecuta la suite de validación completa.
