#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "--- CONFIGURANDO ENTORNO ---"
if [ ! -f .env ]; then
    cp .env.example .env
    sed -i 's/localhost/127.0.0.1/g' .env
fi

if [ ! -f cmd/server/main.go ]; then
    mkdir -p cmd/server
    cat <<'EOF' > cmd/server/main.go
package main

import (
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
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	conn := utils.ConnectDB()
	defer conn.Postgres.Close()
	q := repository.New(conn.Postgres)

	r := gin.Default()
	r.Use(CORSMiddleware())
	r.StaticFile("/web", "./frontend/index.html")
	r.Static("/web/static", "./frontend")

	v1 := r.Group("/api/v1")
	{
		v1.POST("/auth/register", handler.NewAuthHandler(service.NewAuthService(q, conn.Redis)).Register)
		v1.POST("/auth/login", handler.NewAuthHandler(service.NewAuthService(q, conn.Redis)).Login)
		v1.GET("/leaderboard", handler.NewScoringHandler(service.NewScoringService(q, conn.Redis), q).GetLeaderboard)
		v1.Use(middleware.AuthMiddleware())
		{
			v1.GET("/leaderboard/me", handler.NewScoringHandler(service.NewScoringService(q, conn.Redis), q).GetMyRank)
			v1.GET("/players", handler.NewPlayerHandler(service.NewPlayerService(q)).GetPlayers)
			v1.POST("/squad", handler.NewSquadHandler(service.NewSquadService(q, service.NewPlayerService(q))).InitSquad)
			v1.GET("/squad", handler.NewSquadHandler(service.NewSquadService(q, service.NewPlayerService(q))).GetSquad)
			v1.POST("/squad/players", handler.NewSquadHandler(service.NewSquadService(q, service.NewPlayerService(q))).AddPlayer)
			v1.PATCH("/squad/formation", handler.NewSquadHandler(service.NewSquadService(q, service.NewPlayerService(q))).ChangeFormation)
			v1.POST("/admin/results", handler.NewScoringHandler(service.NewScoringService(q, conn.Redis), q).PostResult)
		}
	}
	r.Run(":" + port)
}
EOF
fi

echo "✅ Configuración finalizada."
