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

// normalize removes diacritics and lowercases — allows "rolando" to match "Rólando".
func normalize(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, s)
	return strings.ToLower(result)
}

// relevanceGroup classifies a hit into one of three tiers:
//
//	0 → name starts with query   (highest — like Google autocomplete prefix)
//	1 → name contains query but doesn't start with it
//	2 → other fuzzy / ngram match
func relevanceGroup(name, qNorm string) int {
	nameNorm := normalize(name)
	if strings.HasPrefix(nameNorm, qNorm) {
		return 0
	}
	// Check every word boundary: "Lautaro Rolando" contains "rolando" as a whole word.
	// We split on spaces and also check plain Contains for substring matches.
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
		// Fetch more from ES so re-ranking has enough candidates even when
		// the top-N by score don't cover all starts-with results.
		"size":    size * 3,
		"_source": true,
	}
}

type hit struct {
	source map[string]any
	group  int
	// overall is the player's overall rating, used as a tiebreaker within a group.
	overall float64
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

	qNorm := normalize(q)

	// Build intermediate slice with group + overall for sorting.
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

		ranked = append(ranked, hit{
			source:  source,
			group:   group,
			overall: overall,
		})
	}

	// Sort: primary = group ASC (0 best), secondary = overall DESC (higher is better).
	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].group != ranked[j].group {
			return ranked[i].group < ranked[j].group
		}
		return ranked[i].overall > ranked[j].overall
	})

	// Trim to requested size.
	if len(ranked) > size {
		ranked = ranked[:size]
	}

	results := make([]map[string]any, 0, len(ranked))
	for _, r := range ranked {
		results = append(results, r.source)
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