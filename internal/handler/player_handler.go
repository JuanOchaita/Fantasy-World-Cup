package handler

import (
	"net/http"
	"strconv"

	"github.com/delta/fantasy-world-cup/internal/service"
	"github.com/gin-gonic/gin"
)

type PlayerHandler struct {
	playerService *service.PlayerService
}

func NewPlayerHandler(playerService *service.PlayerService) *PlayerHandler {
	return &PlayerHandler{playerService: playerService}
}

func (h *PlayerHandler) GetPlayers(c *gin.Context) {
	query := c.Query("q")
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	players, err := h.playerService.Search(c.Request.Context(), query, int32(limit), int32(offset))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al buscar jugadores"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":   len(players),
		"results": players,
	})
}
