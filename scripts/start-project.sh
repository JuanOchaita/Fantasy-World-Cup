#!/bin/bash

# FANTASY WORLD CUP - START PROJECT SCRIPT (MASTER VERSION)
set -e

cd "$(dirname "$0")/.."
export PATH=$HOME/go_dist/go/bin:$PATH

echo "--- CONFIGURACION ---"
# Restaurar main.go si no existe
if [ ! -f cmd/server/main.go ]; then
    echo "main.go no encontrado. Restaurando desde template..."
    mkdir -p cmd/server
    cat <<EOF > cmd/server/main.go
package main

import (
	"log"
	"os"

	"github.com/delta/fantasy-world-cup/internal/handler"
	"github.com/delta/fantasy-world-cup/internal/middleware"
	"github.com/delta/fantasy-world-cup/internal/repository"
	"github.com/delta/fantasy-world-cup/internal/service"
	"github.com/delta/fantasy-world-cup/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Advertencia: No se encontro archivo .env")
	}

	port := os.Getenv("PORT")
	if port == "" { port = "8080" }

	connections := utils.ConnectDB()
	defer connections.Postgres.Close()

	queries := repository.New(connections.Postgres)
	authService := service.NewAuthService(queries, connections.Redis)
	authHandler := handler.NewAuthHandler(authService)
	playerService := service.NewPlayerService(queries)
	playerHandler := handler.NewPlayerHandler(playerService)
	squadService := service.NewSquadService(queries, playerService)
	squadHandler := handler.NewSquadHandler(squadService)
	scoringService := service.NewScoringService(queries, connections.Redis)
	scoringHandler := handler.NewScoringHandler(scoringService, queries)

	r := gin.Default()
	r.Use(CORSMiddleware())

	r.StaticFile("/web", "./frontend/index.html")
	r.StaticFile("/web/", "./frontend/index.html")
	r.Static("/web/static", "./frontend")

	v1 := r.Group("/api/v1")
	{
		v1.POST("/auth/register", authHandler.Register)
		v1.POST("/auth/login", authHandler.Login)
		v1.GET("/leaderboard", scoringHandler.GetLeaderboard)

		v1.Use(middleware.AuthMiddleware())
		{
			v1.GET("/leaderboard/me", scoringHandler.GetMyRank)
			v1.GET("/players", playerHandler.GetPlayers)
			v1.POST("/squad", squadHandler.InitSquad)
			v1.GET("/squad", squadHandler.GetSquad)
			v1.POST("/squad/players", squadHandler.AddPlayer)
			v1.PATCH("/squad/formation", squadHandler.ChangeFormation)
			v1.POST("/admin/results", scoringHandler.PostResult)
		}
	}

	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.Run(":" + port)
}
EOF
fi

if [ ! -f .env ]; then
    cp .env.example .env
    sed -i 's/localhost/127.0.0.1/g' .env
fi

echo "--- LIMPIEZA ---"
fuser -k 8080/tcp 2>/dev/null || true
docker rm -f db-lab-postgres db-lab-redis 2>/dev/null || true

echo "--- INFRAESTRUCTURA ---"
docker compose down -v
docker compose up -d

until [ "$(docker inspect -f '{{.State.Health.Status}}' db-lab-postgres)" == "healthy" ]; do printf "."; sleep 2; done
until [ "$(docker inspect -f '{{.State.Health.Status}}' db-lab-redis)" == "healthy" ]; do printf "."; sleep 2; done

echo "--- BACKEND (Go) ---"
if command -v sqlc >/dev/null 2>&1; then sqlc generate; else $HOME/go_dist/go/bin/sqlc generate; fi
go mod tidy
go build -o server ./cmd/server/main.go
./server > server.log 2>&1 &

echo "--- PROYECTO INICIADO ---"
