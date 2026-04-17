package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func main() {
	ctx := context.Background()

	pgHost := getEnv("PG_HOST", "localhost")
	pgPort := getEnv("PG_PORT", "5433")
	pgUser := getEnv("PG_USER", "admin")
	pgPass := getEnv("PG_PASSWORD", "admin")
	pgDB := getEnv("PG_DB", "labdb")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		pgHost, pgPort, pgUser, pgPass, pgDB)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("failed to open postgres connection: %v", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("failed to ping postgres: %v", err)
	}

	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	defer rdb.Close()

	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatalf("failed to ping redis: %v", err)
	}

	rows, err := db.QueryContext(ctx, "SELECT * FROM players")
	if err != nil {
		log.Fatalf("failed to query players: %v", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		log.Fatalf("failed to get columns: %v", err)
	}

	playerIDIdx := -1
	for i, col := range cols {
		if col == "player_id" {
			playerIDIdx = i
			break
		}
	}
	if playerIDIdx == -1 {
		log.Fatal("column player_id not found in players table")
	}

	inserted := 0
	skipped := 0

	for rows.Next() {
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}

		if err := rows.Scan(ptrs...); err != nil {
			log.Printf("failed to scan row: %v", err)
			skipped++
			continue
		}

		row := make(map[string]interface{}, len(cols))
		for i, col := range cols {
			switch v := vals[i].(type) {
			case []byte:
				row[col] = string(v)
			default:
				row[col] = v
			}
		}

		playerID := fmt.Sprintf("%v", row["player_id"])
		if playerID == "" {
			log.Printf("skipping row with empty or invalid player_id")
			skipped++
			continue
		}

		jsonVal, err := json.Marshal(row)
		if err != nil {
			log.Printf("failed to marshal row for key %q: %v", playerID, err)
			skipped++
			continue
		}

		if err := rdb.Set(ctx, playerID, jsonVal, 0).Err(); err != nil {
			log.Printf("failed to set redis key %q: %v", playerID, err)
			skipped++
			continue
		}

		inserted++
	}

	if err := rows.Err(); err != nil {
		log.Fatalf("row iteration error: %v", err)
	}

	fmt.Printf("done: %d inserted, %d skipped\n", inserted, skipped)
}