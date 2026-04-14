# FANTASY WORLD CUP - MAKE INTERFACE

setup:
	@chmod +x scripts/*.sh
	@./scripts/setup-project.sh

start:
	@./scripts/start-project.sh

stop:
	@./scripts/stop-project.sh

data:
	@./scripts/seed-data.sh

test:
	@./scripts/run-tests.sh

# Flujo Maestro: Configura, levanta y puebla la DB
build: setup start
	@$(MAKE) data

generate:
	docker run --rm -v "$(PWD):/src" -w /src sqlc/sqlc generate

.PHONY: setup start stop data test build generate
