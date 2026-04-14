package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/redis/go-redis/v9"
)

var rdb *redis.Client

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func playerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := r.URL.Query().Get("name")
	if name == "" {
		http.Error(w, "missing query param: name", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	val, err := rdb.Get(ctx, name).Result()
	if errors.Is(err, redis.Nil) {
		http.Error(w, fmt.Sprintf("player not found: %s", name), http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "redis error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var data map[string]interface{}
	if err := json.Unmarshal([]byte(val), &data); err != nil {
		http.Error(w, "failed to parse stored data", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func main() {
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	port := getEnv("PORT", "8082")

	rdb = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	defer rdb.Close()

	ctx := context.Background()
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatalf("failed to connect to redis: %v", err)
	}

	http.HandleFunc("/player", playerHandler)

	log.Printf("server listening on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}