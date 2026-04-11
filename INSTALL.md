# Guía de Instalación y Replicación (Quick Start)

Esta guía contiene los pasos técnicos necesarios para replicar el proyecto en cualquier máquina local.

## 1. Requisitos Previos
- **Docker**: Motor de contenedores y Docker Compose.
- **Make**: (Recomendado) Para usar la interfaz de comandos unificada.

## 2. Inicialización
Para preparar el entorno y levantar todos los servicios (Base de Datos, Redis y API):

1. **Configuración inicial**:
   ```bash
   make setup
   ```
   *Esto creará automáticamente el archivo `.env` necesario para las credenciales.*

2. **Iniciar servicios**:
   ```bash
   make start
   ```

3. **Detener servicios**:
   ```bash
   make stop
   ```

## 3. Datos de Conexión y Puertos
Una vez levantado el proyecto, los servicios están disponibles en los siguientes puertos locales:

| Servicio | Puerto Local |
| :--- | :--- |
| **API (Go)** | `8080` |
| **PostgreSQL** | `5433` |
| **Redis** | `6379` |

*Host por defecto: `127.0.0.1`*

## 4. Gestión de Base de Datos
Si realizas modificaciones en los archivos SQL, puedes regenerar el código de acceso a datos (`internal/repository`) utilizando:

```bash
make generate
```
