
setup:
	@./scripts/setup-project.sh

start:
	@./scripts/start-project.sh

stop:
	@./scripts/stop-project.sh

data:
	@chmod +x scripts/seed-data.sh
	@./scripts/seed-data.sh

test:
	@chmod +x scripts/run-tests.sh
	@./scripts/run-tests.sh

generate:
	docker run --rm -v "$(PWD):/src" -w /src sqlc/sqlc generate

.PHONY: setup start stop data test generate
