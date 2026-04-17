# Generación de código SQL
FROM golang:1.25 AS sqlc-builder
WORKDIR /app
RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
COPY database ./database
COPY sqlc.yaml .
RUN sqlc generate -f sqlc.yaml

# Construcción del servidor Go
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Copy generated files from sqlc-builder
COPY --from=sqlc-builder /app/internal/repository/ ./internal/repository/
RUN go build -o server ./cmd/server/main.go

# Imagen final
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/.env.example ./.env

EXPOSE 8080
CMD ["./server"]
