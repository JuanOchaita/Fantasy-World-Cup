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
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

var (
	esURL  = getEnv("ES_URL", "http://localhost:9200")
	esUser = getEnv("ES_USER", "")
	esPass = getEnv("ES_PASS", "")
	index  = getEnv("ES_INDEX", "players")
	port   = getEnv("PORT", "8083")
)

var esClient = &http.Client{
	Timeout: 10 * time.Second,
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

func normalize(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, s)
	return strings.ToLower(result)
}

func isNone(v string) bool {
	v = strings.TrimSpace(v)
	return v == "" || strings.EqualFold(v, "none")
}

type filters struct {
	Positions       string
	MinOverall      int
	MaxOverall      int
	MinValueEUR     int64
	MaxValueEUR     int64
	ClubName        string
	NationalityName string
}

func buildQuery(q string, from, size int, f filters) map[string]any {
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

	esQuery := map[string]any{
		"query": map[string]any{
			"bool": map[string]any{
				"should":               should,
				"minimum_should_match": 1,
			},
		},
		// Orden primario por score ES, desempate por overall descendente
		"sort": []any{
			map[string]any{"_score": map[string]any{"order": "desc"}},
			map[string]any{"overall": map[string]any{"order": "desc"}},
		},
		"from":    from,
		"size":    size,
		"_source": true,
	}

	filterClauses := buildFilterClauses(f)
	if len(filterClauses) > 0 {
		esQuery["post_filter"] = map[string]any{
			"bool": map[string]any{"filter": filterClauses},
		}
	}

	return esQuery
}

func buildFilterClauses(f filters) []any {
	var clauses []any

	if !isNone(f.Positions) {
		parts := strings.Split(f.Positions, ",")
		cleaned := make([]any, 0, len(parts))
		for _, p := range parts {
			if p = strings.TrimSpace(p); p != "" {
				cleaned = append(cleaned, p)
			}
		}
		if len(cleaned) > 0 {
			clauses = append(clauses, map[string]any{
				"terms": map[string]any{"player_positions": cleaned},
			})
		}
	}

	overallRange := map[string]any{}
	if f.MinOverall > 0 {
		overallRange["gte"] = f.MinOverall
	}
	if f.MaxOverall > 0 {
		overallRange["lte"] = f.MaxOverall
	}
	if len(overallRange) > 0 {
		clauses = append(clauses, map[string]any{
			"range": map[string]any{"overall": overallRange},
		})
	}

	valueRange := map[string]any{}
	if f.MinValueEUR > 0 {
		valueRange["gte"] = f.MinValueEUR
	}
	if f.MaxValueEUR > 0 {
		valueRange["lte"] = f.MaxValueEUR
	}
	if len(valueRange) > 0 {
		clauses = append(clauses, map[string]any{
			"range": map[string]any{"value_eur": valueRange},
		})
	}

	if !isNone(f.ClubName) {
		clauses = append(clauses, map[string]any{
			"term": map[string]any{"club_name": f.ClubName},
		})
	}

	if !isNone(f.NationalityName) {
		clauses = append(clauses, map[string]any{
			"term": map[string]any{"nationality_name": f.NationalityName},
		})
	}

	return clauses
}

func parseFilters(r *http.Request) filters {
	f := filters{}
	f.Positions = r.URL.Query().Get("positions")

	if v := r.URL.Query().Get("min_overall"); !isNone(v) {
		if n, err := strconv.Atoi(v); err == nil {
			f.MinOverall = n
		}
	}
	if v := r.URL.Query().Get("max_overall"); !isNone(v) {
		if n, err := strconv.Atoi(v); err == nil {
			f.MaxOverall = n
		}
	}
	if v := r.URL.Query().Get("min_value_eur"); !isNone(v) {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			f.MinValueEUR = n
		}
	}
	if v := r.URL.Query().Get("max_value_eur"); !isNone(v) {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			f.MaxValueEUR = n
		}
	}
	f.ClubName = r.URL.Query().Get("club_name")
	f.NationalityName = r.URL.Query().Get("nationality")

	return f
}

func searchPlayers(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		jsonError(w, "missing query param: q", http.StatusBadRequest)
		return
	}

	pageSize := 50
	if s := r.URL.Query().Get("size"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 200 {
			pageSize = n
		}
	}

	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}

	from := (page - 1) * pageSize
	f := parseFilters(r)
	query := buildQuery(q, from, pageSize, f)

	body, err := json.Marshal(query)
	if err != nil {
		jsonError(w, "failed to build query", http.StatusInternalServerError)
		return
	}

	esReqURL := fmt.Sprintf("%s/%s/_search", esURL, index)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, esReqURL, bytes.NewReader(body))
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

	hitsData, _ := esResp["hits"].(map[string]any)
	innerHits, _ := hitsData["hits"].([]any)
	totalMap, _ := hitsData["total"].(map[string]any)

	totalItems := 0
	if v, ok := totalMap["value"].(float64); ok {
		totalItems = int(v)
	}

	totalPages := (totalItems + pageSize - 1) / pageSize

	results := make([]map[string]any, 0, len(innerHits))
	for _, h := range innerHits {
		esHit, ok := h.(map[string]any)
		if !ok {
			continue
		}
		source, _ := esHit["_source"].(map[string]any)
		if source == nil {
			continue
		}
		results = append(results, source)
	}

	elapsed := time.Since(start).Milliseconds()

	out, _ := json.Marshal(map[string]any{
		"query": q,
		"pagination": map[string]any{
			"current_page": page,
			"page_size":    pageSize,
			"total_pages":  totalPages,
			"total_items":  totalItems,
		},
		"took_ms": elapsed,
		"results": results,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(out)

	log.Printf("q=%q page=%d/%d size=%d results=%d took=%dms", q, page, totalPages, pageSize, len(results), elapsed)
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

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s %s", r.Method, r.URL.String(), r.RemoteAddr)
		next(w, r)
	}
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	http.HandleFunc("/search/players", corsMiddleware(loggingMiddleware(searchPlayers)))
	http.HandleFunc("/health", corsMiddleware(loggingMiddleware(healthCheck)))

	log.Printf("server starting on :%s", port)
	log.Printf("elasticsearch: %s  index: %s", esURL, index)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}