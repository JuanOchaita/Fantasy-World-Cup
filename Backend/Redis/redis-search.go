package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

var ctx = context.Background()
var rdb *redis.Client

// playerEntry es el formato almacenado en Redis para cada jugador.
type playerEntry struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// normalize quita acentos/diacríticos y convierte a minúsculas,
// igual que en redis-main.go para que las keys coincidan.
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

// normalizeKey aplica el mismo pipeline que redis-main.go sobre el input del usuario.
func normalizeKey(raw string) string {
	return strings.TrimSpace(cleanName(normalize(raw)))
}

func main() {
	rdb = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	if _, err := rdb.Ping(ctx).Result(); err != nil {
		panic(err)
	}

	router := gin.Default()

	// Middleware CORS simple
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Servir el archivo index.html en la raíz
	router.GET("/", func(c *gin.Context) {
		c.File("index.html")
	})

	router.GET("/redis", getRedisValue)
	router.POST("/redis", getRedisValue)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	router.Run(":" + port)
}

func getRedisValue(c *gin.Context) {
	// Leer key desde query param o body JSON
	key := c.Query("key")
	if key == "" {
		var body struct {
			Key string `json:"key"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Key == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Key required"})
			return
		}
		key = body.Key
	}

	// Aplicar el mismo pipeline de normalización usado al indexar
	normalizedKey := normalizeKey(key)
	if normalizedKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Key is empty after normalization"})
		return
	}

	val, err := rdb.Get(ctx, normalizedKey).Result()
	if err == redis.Nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Key not found", "key": normalizedKey})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Deserializar el array de playerEntry y devolverlo directamente
	var players []playerEntry
	if err := json.Unmarshal([]byte(val), &players); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deserializando valor de Redis"})
		return
	}

	c.JSON(http.StatusOK, players)
}