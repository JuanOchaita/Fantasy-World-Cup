package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

var (
	esURL  = getEnv("ES_URL", "http://localhost:9200")
	esUser = getEnv("ES_USER", "")
	esPass = getEnv("ES_PASS", "")
	index  = getEnv("ES_INDEX", "players")
	port   = getEnv("PORT", "8080")
)

var esClient = &http.Client{
	Timeout: 5 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 100,
		IdleConnTimeout:     90 * time.Second,
	},
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func buildQuery(q string, size int) map[string]any {
	qLower := strings.ToLower(strings.TrimSpace(q))

	should := []any{
		map[string]any{
			"prefix": map[string]any{
				"long_name.keyword": map[string]any{
					"value":            q,
					"case_insensitive": true,
					"boost":            5,
				},
			},
		},
		map[string]any{
			"match_phrase_prefix": map[string]any{
				"long_name": map[string]any{
					"query":          q,
					"max_expansions": 50,
					"boost":          4,
				},
			},
		},
	}

	if len(qLower) >= 2 {
		should = append(should,
			map[string]any{
				"match": map[string]any{
					"long_name": map[string]any{
						"query":         q,
						"fuzziness":     "AUTO",
						"prefix_length": 1,
						"operator":      "and",
						"boost":         3,
					},
				},
			},
			map[string]any{
				"match": map[string]any{
					"long_name": map[string]any{
						"query":         q,
						"fuzziness":     "AUTO",
						"prefix_length": 1,
						"operator":      "or",
						"boost":         2,
					},
				},
			},
		)
	}

	if len(qLower) >= 3 {
		should = append(should,
			map[string]any{
				"match": map[string]any{
					"long_name.ngram": map[string]any{
						"query": q,
						"boost": 1,
					},
				},
			},
		)
	}

	baseQuery := map[string]any{
		"bool": map[string]any{
			"should":               should,
			"minimum_should_match": 1,
		},
	}

	return map[string]any{
		"query": map[string]any{
			"function_score": map[string]any{
				"query": baseQuery,
				"functions": []any{
					map[string]any{
						"filter": map[string]any{
							"prefix": map[string]any{
								"long_name.keyword": map[string]any{
									"value":            q,
									"case_insensitive": true,
								},
							},
						},
						"weight": 1000,
					},
					map[string]any{
						"filter": map[string]any{
							"match_phrase": map[string]any{
								"long_name": q,
							},
						},
						"weight": 500,
					},
					map[string]any{
						"field_value_factor": map[string]any{
							"field":    "overall",
							"factor":   0.1,
							"modifier": "none",
							"missing":  0,
						},
					},
				},
				"score_mode": "sum",
				"boost_mode": "sum",
			},
		},
		"size":    size,
		"_source": true,
	}
}

func searchPlayers(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		jsonError(w, "missing query param: q", http.StatusBadRequest)
		return
	}

	size := 20
	if s := r.URL.Query().Get("size"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 100 {
			size = n
		}
	}

	query := buildQuery(q, size)

	body, err := json.Marshal(query)
	if err != nil {
		jsonError(w, "failed to build query", http.StatusInternalServerError)
		return
	}

	url := fmt.Sprintf("%s/%s/_search", esURL, index)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		jsonError(w, "failed to create request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if esUser != "" {
		req.SetBasicAuth(esUser, esPass)
	}

	resp, err := esClient.Do(req)
	if err != nil {
		jsonError(w, "elasticsearch unreachable: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		jsonError(w, "failed to read response", http.StatusInternalServerError)
		return
	}

	var esResp map[string]any
	if err := json.Unmarshal(raw, &esResp); err != nil {
		jsonError(w, "failed to parse response", http.StatusInternalServerError)
		return
	}

	if esError, ok := esResp["error"]; ok {
		log.Printf("elasticsearch error: %v", esError)
		jsonError(w, "elasticsearch returned an error", http.StatusBadGateway)
		return
	}

	hits, _ := esResp["hits"].(map[string]any)
	innerHits, _ := hits["hits"].([]any)
	total, _ := hits["total"].(map[string]any)

	results := make([]map[string]any, 0, len(innerHits))
	for _, h := range innerHits {
		hit, ok := h.(map[string]any)
		if !ok {
			continue
		}
		source, _ := hit["_source"].(map[string]any)
		if source == nil {
			source = map[string]any{}
		}
		source["_id"] = hit["_id"]
		source["_score"] = hit["_score"]
		results = append(results, source)
	}

	elapsed := time.Since(start).Milliseconds()

	out, _ := json.Marshal(map[string]any{
		"query":   q,
		"total":   total,
		"size":    size,
		"took_ms": elapsed,
		"results": results,
	})

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Took-Ms", fmt.Sprintf("%d", elapsed))
	w.WriteHeader(http.StatusOK)
	w.Write(out)

	log.Printf("q=%q size=%d results=%d took=%dms", q, size, len(results), elapsed)
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	url := fmt.Sprintf("%s/_cluster/health", esURL)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, url, nil)
	if err != nil {
		jsonError(w, "failed to build health request", http.StatusInternalServerError)
		return
	}
	if esUser != "" {
		req.SetBasicAuth(esUser, esPass)
	}

	resp, err := esClient.Do(req)
	if err != nil {
		jsonError(w, "elasticsearch unreachable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(raw)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	out, _ := json.Marshal(map[string]string{"error": msg})
	w.Write(out)
}

func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s %s", r.Method, r.URL.String(), r.RemoteAddr)
		next(w, r)
	}
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	http.HandleFunc("/search/players", loggingMiddleware(searchPlayers))
	http.HandleFunc("/health", loggingMiddleware(healthCheck))

	log.Printf("server starting on :%s", port)
	log.Printf("elasticsearch: %s index: %s", esURL, index)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}