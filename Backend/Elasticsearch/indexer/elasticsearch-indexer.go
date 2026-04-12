package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

var (
	pgConn    = getEnv("PG_CONN", "host=localhost port=5433 user=admin password=admin dbname=labdb sslmode=disable")
	esURL     = getEnv("ES_URL", "http://localhost:9200")
	esIndex   = getEnv("ES_INDEX", "players")
	batchSize = 500
)

var esClient = &http.Client{
	Timeout: 30 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        10,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	},
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type Player struct {
	LongName string `json:"long_name"`
	Overall  int    `json:"overall"`
}

func createIndex() error {
	checkURL := fmt.Sprintf("%s/%s", esURL, esIndex)
	resp, err := esClient.Get(checkURL)
	if err != nil {
		return fmt.Errorf("failed to check index: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		log.Printf("index %q already exists, skipping creation", esIndex)
		return nil
	}

	mapping := map[string]any{
		"settings": map[string]any{
			"number_of_shards":   1,
			"number_of_replicas": 0,
			"analysis": map[string]any{
				"tokenizer": map[string]any{
					"ngram_tokenizer": map[string]any{
						"type":        "ngram",
						"min_gram":    3,
						"max_gram":    4,
						"token_chars": []string{"letter", "digit"},
					},
				},
				"analyzer": map[string]any{
					"ngram_analyzer": map[string]any{
						"type":      "custom",
						"tokenizer": "ngram_tokenizer",
						"filter":    []string{"lowercase"},
					},
				},
			},
		},
		"mappings": map[string]any{
			"properties": map[string]any{
				"long_name": map[string]any{
					"type":     "text",
					"analyzer": "standard",
					"fields": map[string]any{
						"ngram": map[string]any{
							"type":     "text",
							"analyzer": "ngram_analyzer",
						},
						"keyword": map[string]any{
							"type":         "keyword",
							"ignore_above": 256,
						},
					},
				},
				"overall": map[string]any{
					"type": "integer",
				},
			},
		},
	}

	body, _ := json.Marshal(mapping)
	req, err := http.NewRequest(http.MethodPut, checkURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to build create index request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err = esClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("create index failed (%d): %s", resp.StatusCode, string(raw))
	}

	log.Printf("index %q created successfully", esIndex)
	return nil
}

func bulkInsert(players []Player) (int, error) {
	var sb strings.Builder
	meta := `{"index":{}}` + "\n"
	for _, p := range players {
		data, err := json.Marshal(p)
		if err != nil {
			continue
		}
		sb.WriteString(meta)
		sb.Write(data)
		sb.WriteByte('\n')
	}

	url := fmt.Sprintf("%s/%s/_bulk", esURL, esIndex)
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(sb.String()))
	if err != nil {
		return 0, fmt.Errorf("failed to build bulk request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := esClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("bulk request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	var result struct {
		Errors bool                        `json:"errors"`
		Items  []map[string]map[string]any `json:"items"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return 0, fmt.Errorf("failed to parse bulk response: %w", err)
	}

	if result.Errors {
		errCount := 0
		for _, item := range result.Items {
			if idx, ok := item["index"]; ok {
				if status, ok := idx["status"].(float64); ok && int(status) >= 400 {
					errCount++
					log.Printf("bulk item error: %v", idx["error"])
				}
			}
		}
		log.Printf("bulk completed with %d errors out of %d", errCount, len(players))
		return len(players) - errCount, nil
	}

	return len(players), nil
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	start := time.Now()

	log.Printf("connecting to postgres: %s", pgConn)
	db, err := sql.Open("postgres", pgConn)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.PingContext(context.Background()); err != nil {
		log.Fatalf("failed to ping postgres: %v", err)
	}
	log.Println("postgres connected")

	if err := createIndex(); err != nil {
		log.Fatalf("failed to setup index: %v", err)
	}

	rows, err := db.QueryContext(context.Background(),
		"SELECT long_name::text, overall FROM players WHERE long_name IS NOT NULL AND long_name != ''")
	if err != nil {
		log.Fatalf("failed to query players: %v", err)
	}
	defer rows.Close()

	var (
		batch    []Player
		total    int
		inserted int
	)

	for rows.Next() {
		var name string
		var overall int
		if err := rows.Scan(&name, &overall); err != nil {
			log.Printf("scan error: %v", err)
			continue
		}
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		batch = append(batch, Player{LongName: name, Overall: overall})
		total++

		if len(batch) >= batchSize {
			n, err := bulkInsert(batch)
			if err != nil {
				log.Printf("bulk insert error: %v", err)
			} else {
				inserted += n
				log.Printf("indexed %d/%d players", inserted, total)
			}
			batch = batch[:0]
		}
	}

	if len(batch) > 0 {
		n, err := bulkInsert(batch)
		if err != nil {
			log.Printf("bulk insert error: %v", err)
		} else {
			inserted += n
		}
	}

	if err := rows.Err(); err != nil {
		log.Printf("rows iteration error: %v", err)
	}

	log.Printf("done: %d/%d players indexed in %s", inserted, total, time.Since(start).Round(time.Millisecond))
}