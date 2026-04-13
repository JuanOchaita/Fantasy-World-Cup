#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "--- CONFIGURANDO ENTORNO ---"
if [ ! -f .env ]; then
    cp .env.example .env
    sed -i 's/localhost/127.0.0.1/g' .env
fi

# Recrear main.go con Sincronización Automática de Redis
mkdir -p cmd/server
cat <<'EOF' > cmd/server/main.go
package main

import (
	"context"
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
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PATCH")
		if c.Request.Method == "OPTIONS" { c.AbortWithStatus(204); return }
		c.Next()
	}
}

func main() {
	godotenv.Load()
	port := os.Getenv("PORT"); if port == "" { port = "8080" }
	conn := utils.ConnectDB()
	defer conn.Postgres.Close()
	q := repository.New(conn.Postgres)
	
	authSvc := service.NewAuthService(q, conn.Redis)
	playerSvc := service.NewPlayerService(q)
	squadSvc := service.NewSquadService(q, playerSvc)
	scoreSvc := service.NewScoringService(q, conn.Redis)

	// Sincronización inicial de Redis (Vital para Dashboard)
	scoreSvc.SyncLeaderboardToRedis(context.Background())

	authH := handler.NewAuthHandler(authSvc)
	playerH := handler.NewPlayerHandler(playerSvc)
	squadH := handler.NewSquadHandler(squadSvc)
	scoreH := handler.NewScoringHandler(scoreSvc, q)

	r := gin.Default()
	r.Use(CORSMiddleware())
	r.StaticFile("/web", "./frontend/index.html")
	r.StaticFile("/web/", "./frontend/index.html")
	r.Static("/web/static", "./frontend")

	v1 := r.Group("/api/v1")
	{
		v1.POST("/auth/register", authH.Register)
		v1.POST("/auth/login", authH.Login)
		v1.POST("/auth/refresh", authH.Refresh)
		v1.GET("/leaderboard", scoreH.GetLeaderboard)

		v1.Use(middleware.AuthMiddleware())
		{
			v1.GET("/leaderboard/me", scoreH.GetMyRank)
			v1.GET("/players", playerH.GetPlayers)
			v1.POST("/squad", squadH.InitSquad)
			v1.GET("/squad", squadH.GetSquad)
			v1.POST("/squad/players", squadH.AddPlayer)
			v1.PATCH("/squad/formation", squadH.ChangeFormation)
			v1.POST("/admin/results", scoreH.PostResult)
		}
	}
	r.Run(":" + port)
}
EOF

if command -v sqlc >/dev/null 2>&1; then sqlc generate; else $HOME/go_dist/go/bin/sqlc generate; fi
echo "Configuración finalizada."
