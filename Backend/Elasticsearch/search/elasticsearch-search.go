package main

import (
	"bytes"
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

// normalize removes diacritics and lowercases.
func normalize(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, s)
	return strings.ToLower(result)
}

// isNone returns true when the caller explicitly passes "none" or an empty string,
// meaning the filter should be ignored.
func isNone(v string) bool {
	v = strings.TrimSpace(v)
	return v == "" || strings.EqualFold(v, "none")
}

// relevanceGroup classifies a hit into one of three tiers:
//
//	0 → name starts with query   (highest)
//	1 → name contains query but doesn't start with it
//	2 → other fuzzy / ngram match
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

// filters holds the optional filter values parsed from the request.
type filters struct {
	Positions       string // comma-separated list, e.g. "ST,CF"  — none = disabled
	MinOverall      int    // 0 = disabled
	MaxOverall      int    // 0 = disabled
	MinValueEUR     int64  // 0 = disabled
	MaxValueEUR     int64  // 0 = disabled
	ClubName        string // none = disabled
	NationalityName string // none = disabled
}

// buildQuery constructs the Elasticsearch query with optional filters applied as
// post-filter clauses so they narrow results without affecting relevance scoring.
func buildQuery(q string, size int, f filters) map[string]any {
	qLower := strings.ToLower(strings.TrimSpace(q))

	// ── relevance (unchanged from original) ─────────────────────────────────
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

	mainQuery := map[string]any{
		"bool": map[string]any{
			"should":               should,
			"minimum_should_match": 1,
		},
	}

	// ── filters (applied as post_filter so scores stay clean) ───────────────
	filterClauses := buildFilterClauses(f)

	esQuery := map[string]any{
		"query":   mainQuery,
		"size":    size * 3,
		"_source": true,
	}

	if len(filterClauses) > 0 {
		esQuery["post_filter"] = map[string]any{
			"bool": map[string]any{
				"filter": filterClauses,
			},
		}
	}

	return esQuery
}

// buildFilterClauses translates the filters struct into ES filter DSL clauses.
// Only active (non-none) filters are included.
func buildFilterClauses(f filters) []any {
	var clauses []any

	// player_positions: supports comma-separated values → terms query
	if !isNone(f.Positions) {
		parts := strings.Split(f.Positions, ",")
		cleaned := make([]any, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				cleaned = append(cleaned, p)
			}
		}
		if len(cleaned) > 0 {
			clauses = append(clauses, map[string]any{
				"terms": map[string]any{
					"player_positions": cleaned,
				},
			})
		}
	}

	// overall range
	overallRange := map[string]any{}
	if f.MinOverall > 0 {
		overallRange["gte"] = f.MinOverall
	}
	if f.MaxOverall > 0 {
		overallRange["lte"] = f.MaxOverall
	}
	if len(overallRange) > 0 {
		clauses = append(clauses, map[string]any{
			"range": map[string]any{
				"overall": overallRange,
			},
		})
	}

	// value_eur range
	valueRange := map[string]any{}
	if f.MinValueEUR > 0 {
		valueRange["gte"] = f.MinValueEUR
	}
	if f.MaxValueEUR > 0 {
		valueRange["lte"] = f.MaxValueEUR
	}
	if len(valueRange) > 0 {
		clauses = append(clauses, map[string]any{
			"range": map[string]any{
				"value_eur": valueRange,
			},
		})
	}

	// club_name exact match
	if !isNone(f.ClubName) {
		clauses = append(clauses, map[string]any{
			"term": map[string]any{
				"club_name": f.ClubName,
			},
		})
	}

	// nationality_name exact match
	if !isNone(f.NationalityName) {
		clauses = append(clauses, map[string]any{
			"term": map[string]any{
				"nationality_name": f.NationalityName,
			},
		})
	}

	return clauses
}

type hit struct {
	source  map[string]any
	group   int
	overall float64
}

// parseFilters reads filter query params. Any param absent or set to "none" is ignored.
//
// Query params:
//
//	positions       → comma-separated positions (e.g. "ST,CF") or "none"
//	min_overall     → integer or "none"
//	max_overall     → integer or "none"
//	min_value_eur   → integer or "none"
//	max_value_eur   → integer or "none"
//	club_name       → string or "none"
//	nationality     → string or "none"
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

	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		jsonError(w, "missing query param: q", http.StatusBadRequest)
		return
	}

	// --- Parámetros de Paginación ---
	pageSize := 50
	if s := r.URL.Query().Get("size"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			pageSize = n
		}
	}

	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}

	f := parseFilters(r)
	// Para el ranking en Go, necesitamos traer suficientes candidatos de ES.
	// Traemos un margen amplio para asegurar que el ordenamiento post-ES sea preciso.
	query := buildQuery(q, 1000, f) 
	query["size"] = 1000 

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

	hitsData, _ := esResp["hits"].(map[string]any)
	innerHits, _ := hitsData["hits"].([]any)
	totalMap, _ := hitsData["total"].(map[string]any)
	totalValue := 0
	if v, ok := totalMap["value"].(float64); ok {
		totalValue = int(v)
	}

	qNorm := normalize(q)
	ranked := make([]hit, 0, len(innerHits))
	for _, h := range innerHits {
		esHit, _ := h.(map[string]any)
		source, _ := esHit["_source"].(map[string]any)
		if source == nil { continue }
		source["_id"] = esHit["_id"]
		source["_score"] = esHit["_score"]
		name, _ := source["long_name"].(string)
		
		var overall float64
		switch v := source["overall"].(type) {
		case float64: overall = v
		case int: overall = float64(v)
		}

		ranked = append(ranked, hit{
			source:  source,
			group:   relevanceGroup(name, qNorm),
			overall: overall,
		})
	}

	// Ordenamiento global de los resultados obtenidos
	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].group != ranked[j].group {
			return ranked[i].group < ranked[j].group
		}
		return ranked[i].overall > ranked[j].overall
	})

	// --- Lógica de Paginación en Go ---
	totalItems := len(ranked)
	totalPages := (totalItems + pageSize - 1) / pageSize
	if page > totalPages && totalPages > 0 {
		page = totalPages
	}

	startIdx := (page - 1) * pageSize
	endIdx := startIdx + pageSize
	if startIdx > totalItems { startIdx = totalItems }
	if endIdx > totalItems { endIdx = totalItems }

	pagedResults := make([]map[string]any, 0)
	for i := startIdx; i < endIdx; i++ {
		pagedResults = append(pagedResults, ranked[i].source)
	}

	elapsed := time.Since(start).Milliseconds()

	out, _ := json.Marshal(map[string]any{
		"query": q,
		"pagination": map[string]any{
			"current_page": page,
			"page_size":    pageSize,
			"total_pages":  totalPages,
			"total_items":  totalItems,
			"total_found":  totalValue, // Total real en ES
		},
		"took_ms": elapsed,
		"results": pagedResults,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(out)

	log.Printf("q=%q page=%d/%d results=%d took=%dms", q, page, totalPages, len(pagedResults), elapsed)
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
		// Log para depuración
		log.Printf("CORS Middleware: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "X-Took-Ms")

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
	log.Printf("elasticsearch: %s index: %s", esURL, index)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}