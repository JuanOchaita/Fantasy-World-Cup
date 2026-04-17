# FANTASY WORLD CUP - INTERFAZ MAESTRA

# 1. Construye entorno, genera archivos, descarga dependencias y LEVANTA
build:
	@chmod +x scripts/*.sh
	@./scripts/setup-project.sh
	@./scripts/start-project.sh

# 2. Inicia los contenedores ya construidos
start:
	@./scripts/start-project.sh

# 3. Detiene los contenedores sin eliminarlos
pause:
	@docker compose stop
	@echo "Servicios en pausa."

# 4. Elimina contenedores y volúmenes (limpieza total)
stop:
	@./scripts/stop-project.sh

# 5. Puebla la base de datos con Admin y 10 usuarios
data:
	@./scripts/seed-data.sh

# 6. Verificación exhaustiva de salud del sistema
test:
	@./scripts/run-tests.sh

.PHONY: build start pause stop data test
