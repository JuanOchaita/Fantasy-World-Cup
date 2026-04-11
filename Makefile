
setup:
	@./scripts/setup-project.sh

start:
	@./scripts/start-project.sh

stop:
	@./scripts/stop-project.sh

generate:
	docker run --rm -v "$(PWD):/src" -w /src sqlc/sqlc generate

.PHONY: setup start stop generate
