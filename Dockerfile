# Construcción del servidor Go
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd/server/main.go

# Imagen final
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/.env.example ./.env

EXPOSE 8080
CMD ["./server"]
