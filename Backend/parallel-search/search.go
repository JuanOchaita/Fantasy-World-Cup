package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/redis/go-redis/v9"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

var (
	esURL    = getEnv("ES_URL", "http://localhost:9200")
	esUser   = getEnv("ES_USER", "")
	esPass   = getEnv("ES_PASS", "")
	esIndex  = getEnv("ES_INDEX", "players")
	port     = getEnv("PORT", "8080")
	redisAddr = getEnv("REDIS_ADDR", "localhost:6379")
	redisPass = getEnv("REDIS_PASS", "")
)

var esClient = &http.Client{
	Timeout: 5 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 100,
		IdleConnTimeout:     90 * time.Second,
	},
}

var rdb *redis.Client

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func normalize(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, s)
	return strings.ToLower(result)
}

func cleanName(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || r == ' ' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func normalizeKey(raw string) string {
	return strings.TrimSpace(cleanName(normalize(raw)))
}

type redisResult struct {
	found bool
	value string
}

func queryRedis(ctx context.Context, key string, ch chan<- redisResult) {
	val, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		ch <- redisResult{found: false}
		return
	}
	if err != nil {
		ch <- redisResult{found: false}
		return
	}
	ch <- redisResult{found: true, value: val}
}

type hit struct {
	source  map[string]any
	group   int
	overall float64
}

func relevanceGroup(name, qNorm string) int {
	nameNorm := normalize(name)
	if strings.HasPrefix(nameNorm, qNorm) {
		return 0
	}
	if strings.Contains(nameNorm, qNorm) {
		return 1
	}
	return 2
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

	return map[string]any{
		"query": map[string]any{
			"bool": map[string]any{
				"should":               should,
				"minimum_should_match": 1,
			},
		},
		"size":    size * 3,
		"_source": true,
	}
}

type esResult struct {
	results []map[string]any
	total   map[string]any
	err     error
}

func queryElasticsearch(ctx context.Context, q string, size int, ch chan<- esResult) {
	query := buildQuery(q, size)

	body, err := json.Marshal(query)
	if err != nil {
		ch <- esResult{err: err}
		return
	}

	url := fmt.Sprintf("%s/%s/_search", esURL, esIndex)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		ch <- esResult{err: err}
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if esUser != "" {
		req.SetBasicAuth(esUser, esPass)
	}

	resp, err := esClient.Do(req)
	if err != nil {
		ch <- esResult{err: err}
		return
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		ch <- esResult{err: err}
		return
	}

	var esResp map[string]any
	if err := json.Unmarshal(raw, &esResp); err != nil {
		ch <- esResult{err: err}
		return
	}

	if esError, ok := esResp["error"]; ok {
		ch <- esResult{err: fmt.Errorf("elasticsearch error: %v", esError)}
		return
	}

	hits, _ := esResp["hits"].(map[string]any)
	innerHits, _ := hits["hits"].([]any)
	total, _ := hits["total"].(map[string]any)

	qNorm := normalize(q)

	ranked := make([]hit, 0, len(innerHits))
	for _, h := range innerHits {
		esHit, ok := h.(map[string]any)
		if !ok {
			continue
		}
		source, _ := esHit["_source"].(map[string]any)
		if source == nil {
			source = map[string]any{}
		}
		source["_id"] = esHit["_id"]
		source["_score"] = esHit["_score"]

		name, _ := source["long_name"].(string)
		group := relevanceGroup(name, qNorm)

		var overall float64
		switch v := source["overall"].(type) {
		case float64:
			overall = v
		case int:
			overall = float64(v)
		}

		ranked = append(ranked, hit{source: source, group: group, overall: overall})
	}

	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].group != ranked[j].group {
			return ranked[i].group < ranked[j].group
		}
		return ranked[i].overall > ranked[j].overall
	})

	if len(ranked) > size {
		ranked = ranked[:size]
	}

	results := make([]map[string]any, 0, len(ranked))
	for _, r := range ranked {
		results = append(results, r.source)
	}

	ch <- esResult{results: results, total: total}
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
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

	redisKey := normalizeKey(q)

	redisCh := make(chan redisResult, 1)
	esCh := make(chan esResult, 1)

	esCtx, esCancel := context.WithCancel(r.Context())
	defer esCancel()

	go queryRedis(r.Context(), redisKey, redisCh)
	go queryElasticsearch(esCtx, q, size, esCh)

	redisRes := <-redisCh

	if redisRes.found {
		esCancel()

		elapsed := time.Since(start).Milliseconds()
		out, _ := json.Marshal(map[string]any{
			"source":  "redis",
			"key":     redisKey,
			"value":   redisRes.value,
			"took_ms": elapsed,
		})
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Took-Ms", fmt.Sprintf("%d", elapsed))
		w.WriteHeader(http.StatusOK)
		w.Write(out)
		log.Printf("source=redis q=%q took=%dms", q, elapsed)
		return
	}

	esRes := <-esCh

	elapsed := time.Since(start).Milliseconds()

	if esRes.err != nil {
		log.Printf("elasticsearch error: %v", esRes.err)
		jsonError(w, "elasticsearch error: "+esRes.err.Error(), http.StatusBadGateway)
		return
	}

	out, _ := json.Marshal(map[string]any{
		"source":  "elasticsearch",
		"query":   q,
		"total":   esRes.total,
		"size":    size,
		"took_ms": elapsed,
		"results": esRes.results,
	})
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Took-Ms", fmt.Sprintf("%d", elapsed))
	w.WriteHeader(http.StatusOK)
	w.Write(out)
	log.Printf("source=elasticsearch q=%q size=%d results=%d took=%dms", q, size, len(esRes.results), elapsed)
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

	rdb = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPass,
		DB:       0,
	})

	if _, err := rdb.Ping(context.Background()).Result(); err != nil {
		log.Fatalf("redis unreachable: %v", err)
	}
	log.Printf("redis connected: %s", redisAddr)
	log.Printf("elasticsearch: %s index: %s", esURL, esIndex)

	http.HandleFunc("/search/players", loggingMiddleware(searchHandler))
	http.HandleFunc("/health", loggingMiddleware(healthCheck))

	log.Printf("server starting on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}