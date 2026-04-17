package utils

import (
	"context"
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

type DBConnections struct {
	Postgres *sql.DB
	Redis    *redis.Client
}

func ConnectDB() *DBConnections {
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		log.Fatal("DB_URL no esta configurada")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Error al conectar a Postgres:", err)
	}

	if err := db.Ping(); err != nil {
		log.Fatal("No se puede hacer ping a Postgres:", err)
	}

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Println("Advertencia: No se pudo conectar a Redis:", err)
	}

	return &DBConnections{
		Postgres: db,
		Redis:    rdb,
	}
}
