package main

// Genera un Key-value para todas las combinaciones de prefijos de cada palabra del nombre completo de cada jugador.
// Normaliza los nombres, elimina caracteres no ASCII y almacena en Redis.
// Los resultados se ordenan por relevancia estilo Google:
//   - Exactitud del match  (peso 0.50): prefixLen / wordLen  → 1.0 si el query cubre toda la palabra
//   - Posición de la palabra (peso 0.35): 1 / (wordPos + 1)  → primer nombre vale más
//   - Longitud del nombre  (peso 0.15): 1 / len(name)        → nombres cortos suben ante igual score
//   - Desempate final: overall DESC (campo de PostgreSQL, no se almacena en Redis)

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
	"unicode"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

var (
	postgresql_host     = "localhost"
	postgresql_port     = 5433
	postgresql_user     = "admin"
	postgresql_password = "admin"
	postgresql_dbname   = "labdb"

	redis_host     = "localhost"
	redis_port     = 6379
	redis_password = ""
	redis_db       = 0
)

// playerEntry es el formato final almacenado en Redis para cada jugador.
type playerEntry struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// nameEntry guarda el nombre original, el id y las señales de relevancia para ese prefijo concreto.
type nameEntry struct {
	PlayerID  int
	Name      string
	WordPos   int // posición de la palabra que generó el match (0 = primer nombre)
	WordLen   int // longitud de la palabra completa
	PrefixLen int // longitud del prefijo (= longitud del query que lo generó)
	NameLen   int // longitud del nombre completo (para desempate de score)
	Overall   int // overall del jugador en PostgreSQL (desempate final, no se guarda en Redis)
}

// score calcula la relevancia combinada, imitando las señales básicas de Google:
//
//	exactitud  (0.50): qué fracción de la palabra cubre el prefijo
//	posición   (0.35): primer nombre vale más que segundo, etc.
//	brevedad   (0.15): nombres más cortos suben ante igual relevancia
func (e nameEntry) score() float64 {
	exactitud := float64(e.PrefixLen) / float64(e.WordLen) // [0..1]
	posicion := 1.0 / float64(e.WordPos+1)                 // 1, 0.5, 0.33…
	brevedad := 1.0 / float64(e.NameLen)                   // más pequeño = más relevante
	return exactitud*0.50 + posicion*0.35 + brevedad*0.15
}

// normalize quita acentos/diacríticos y pasa a minúsculas.
func normalize(s string) string {
	t := transform.Chain(
		norm.NFD,
		runes.Remove(runes.In(unicode.Mn)),
		norm.NFC,
	)
	result, _, err := transform.String(t, s)
	if err != nil {
		result = s
	}
	return strings.ToLower(result)
}

// cleanName elimina todo carácter que no sea letra ASCII minúscula o espacio.
func cleanName(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || r == ' ' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func main() {
	// ── Conexión PostgreSQL ──────────────────────────────────────────────────
	db, err := sql.Open("postgres", fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		postgresql_host, postgresql_port, postgresql_user, postgresql_password, postgresql_dbname,
	))
	if err != nil {
		log.Fatalf("Error abriendo conexión PostgreSQL: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Error conectando a PostgreSQL: %v", err)
	}
	log.Println("✓ Conectado a PostgreSQL")

	// ── Conexión Redis ───────────────────────────────────────────────────────
	ctx := context.Background()
	r := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", redis_host, redis_port),
		Password: redis_password,
		DB:       redis_db,
	})
	defer r.Close()

	if err := r.Ping(ctx).Err(); err != nil {
		log.Fatalf("Error conectando a Redis: %v", err)
	}
	log.Println("✓ Conectado a Redis")

	// ── Consulta PostgreSQL ──────────────────────────────────────────────────
	rows, err := db.Query("SELECT player_id, long_name, overall FROM players")
	if err != nil {
		log.Fatalf("Error ejecutando query: %v", err)
	}
	defer rows.Close()

	// prefixMap: prefix -> []nameEntry con todas las señales de relevancia
	prefixMap := make(map[string][]nameEntry)

	processed, skipped := 0, 0

	for rows.Next() {
		var playerID      int
		var originalName  string
		var overall       int
		if err := rows.Scan(&playerID, &originalName, &overall); err != nil {
			skipped++
			continue
		}

		normalizedName := normalize(originalName)
		cleanedName    := cleanName(normalizedName)
		parts          := strings.Fields(cleanedName)

		if len(parts) == 0 {
			skipped++
			continue
		}

		nameLen := len(originalName)

		for wordPos, word := range parts {
			wordLen := len(word)
			for prefixLen := 1; prefixLen <= wordLen; prefixLen++ {
				prefix := word[:prefixLen]
				prefixMap[prefix] = append(prefixMap[prefix], nameEntry{
					PlayerID:  playerID,
					Name:      originalName,
					WordPos:   wordPos,
					WordLen:   wordLen,
					PrefixLen: prefixLen,
					NameLen:   nameLen,
					Overall:   overall,
				})
			}
		}

		processed++
	}

	if err := rows.Err(); err != nil {
		log.Fatalf("Error iterando filas: %v", err)
	}
	log.Printf("✓ Procesados: %d jugadores | Omitidos: %d", processed, skipped)

	// ── Ordenar, deduplicar y serializar ────────────────────────────────────
	log.Printf("Iniciando inserción de %d keys en Redis...", len(prefixMap))

	inserted, updated, errors := 0, 0, 0

	for prefix, entries := range prefixMap {
		// 1. Ordenar por score descendente; desempate por overall descendente.
		sort.SliceStable(entries, func(i, j int) bool {
			si, sj := entries[i].score(), entries[j].score()
			if si != sj {
				return si > sj
			}
			return entries[i].Overall > entries[j].Overall
		})

		// 2. Deduplicar: si un jugador aparece por varias palabras,
		//    quedarse solo con su entrada de mayor score (la primera tras el sort).
		seen := make(map[int]struct{})
		orderedPlayers := make([]playerEntry, 0, len(entries))
		for _, e := range entries {
			if _, ok := seen[e.PlayerID]; !ok {
				seen[e.PlayerID] = struct{}{}
				orderedPlayers = append(orderedPlayers, playerEntry{
					ID:   e.PlayerID,
					Name: e.Name,
				})
			}
		}

		// 3. Insertar o hacer merge en Redis
		existing, err := r.Get(ctx, prefix).Result()

		if err == redis.Nil {
			// Key nueva
			data, err := json.Marshal(orderedPlayers)
			if err != nil {
				errors++
				continue
			}
			if err := r.Set(ctx, prefix, data, 0).Err(); err != nil {
				log.Printf("Error insertando key '%s': %v", prefix, err)
				errors++
				continue
			}
			inserted++

		} else if err != nil {
			log.Printf("Error leyendo key '%s' de Redis: %v", prefix, err)
			errors++

		} else {
			// Key existente: agregar al final los jugadores nuevos sin duplicar
			var currentPlayers []playerEntry
			if err := json.Unmarshal([]byte(existing), &currentPlayers); err != nil {
				currentPlayers = []playerEntry{}
			}

			existingSeen := make(map[int]struct{}, len(currentPlayers))
			for _, p := range currentPlayers {
				existingSeen[p.ID] = struct{}{}
			}
			for _, p := range orderedPlayers {
				if _, ok := existingSeen[p.ID]; !ok {
					currentPlayers = append(currentPlayers, p)
					existingSeen[p.ID] = struct{}{}
				}
			}

			data, err := json.Marshal(currentPlayers)
			if err != nil {
				errors++
				continue
			}
			if err := r.Set(ctx, prefix, data, 0).Err(); err != nil {
				log.Printf("Error actualizando key '%s': %v", prefix, err)
				errors++
				continue
			}
			updated++
		}
	}

	log.Printf("✓ Inserción completa → Nuevas: %d | Actualizadas: %d | Errores: %d",
		inserted, updated, errors)
}