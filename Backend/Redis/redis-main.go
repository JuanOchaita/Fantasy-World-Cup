package main

// Genera un Key-value para todas las combinaciones de prefijos de cada palabra del nombre completo de cada jugador,
// normaliza los nombres, elimina caracteres no ASCII (japonés, chino, árabe, etc.) y almacena en Redis.

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
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

// normalize convierte el nombre a minúsculas, descompone caracteres acentuados
// (ej: é -> e + ́) y elimina las marcas diacríticas, dejando solo letras ASCII básicas.
func normalize(s string) string {
	// Paso 1: Descomponer caracteres Unicode combinados (NFD)
	// Paso 2: Eliminar las marcas de acento/diacrítico (categoría Mn = Mark, Nonspacing)
	// Paso 3: Re-encodear a NFC
	t := transform.Chain(
		norm.NFD,
		runes.Remove(runes.In(unicode.Mn)),
		norm.NFC,
	)
	result, _, err := transform.String(t, s)
	if err != nil {
		// Si falla la transformación, usar el string original
		result = s
	}

	// Paso 4: Convertir a minúsculas
	result = strings.ToLower(result)

	return result
}

// isAllowedRune devuelve true si el rune es una letra ASCII (a-z) o un espacio.
// Filtra dígitos, caracteres CJK, árabes, etc.
func isAllowedRune(r rune) bool {
	return (r >= 'a' && r <= 'z') || r == ' '
}

// cleanName elimina cualquier carácter que no sea letra ASCII minúscula o espacio.
func cleanName(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if isAllowedRune(r) {
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
	rows, err := db.Query("SELECT long_name FROM players")
	if err != nil {
		log.Fatalf("Error ejecutando query: %v", err)
	}
	defer rows.Close()

	// prefixMap acumula en memoria: prefix -> []originalName
	// Usamos el nombre ORIGINAL (sin normalizar) como valor en Redis,
	// igual que en el ejemplo del enunciado.
	prefixMap := make(map[string][]string)

	processed := 0
	skipped := 0

	for rows.Next() {
		var originalName string
		if err := rows.Scan(&originalName); err != nil {
			skipped++
			continue
		}

		// 1. Normalizar: quitar acentos y pasar a minúsculas
		normalizedName := normalize(originalName)

		// 2. Limpiar: eliminar caracteres no ASCII-alpha (CJK, árabe, dígitos, etc.)
		cleanedName := cleanName(normalizedName)

		// 3. Dividir por espacios
		parts := strings.Fields(cleanedName)
		if len(parts) == 0 {
			skipped++
			continue
		}

		// 4. Generar todas las combinaciones de prefijos por cada palabra
		for _, word := range parts {
			for i := 1; i <= len(word); i++ {
				prefix := word[:i]
				prefixMap[prefix] = append(prefixMap[prefix], originalName)
			}
		}

		processed++
	}

	if err := rows.Err(); err != nil {
		log.Fatalf("Error iterando filas: %v", err)
	}

	log.Printf("✓ Procesados: %d jugadores | Omitidos: %d", processed, skipped)

	// ── Inserción en Redis ───────────────────────────────────────────────────
	// Para cada prefix: si la key ya existe en Redis, añadimos los nuevos nombres
	// al JSON array existente (sin duplicados). Si no existe, la creamos.

	log.Printf("Iniciando inserción de %d keys en Redis...", len(prefixMap))

	inserted := 0
	updated := 0
	errors := 0

	for prefix, newNames := range prefixMap {
		// Intentar obtener el valor existente
		existing, err := r.Get(ctx, prefix).Result()

		if err == redis.Nil {
			// Key no existe → crear nueva
			data, err := json.Marshal(newNames)
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
			// Key existe → hacer merge evitando duplicados
			var currentNames []string
			if err := json.Unmarshal([]byte(existing), &currentNames); err != nil {
				// Si el valor corrupto, sobreescribir
				currentNames = []string{}
			}

			// Construir set de nombres ya presentes
			seen := make(map[string]struct{}, len(currentNames))
			for _, n := range currentNames {
				seen[n] = struct{}{}
			}

			// Agregar solo los nombres nuevos
			for _, n := range newNames {
				if _, ok := seen[n]; !ok {
					currentNames = append(currentNames, n)
					seen[n] = struct{}{}
				}
			}

			data, err := json.Marshal(currentNames)
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