package handler

import (
	"net/http"

	"github.com/delta/fantasy-world-cup/internal/service"
	"github.com/gin-gonic/gin"
)

type SquadHandler struct {
	squadService *service.SquadService
}

func NewSquadHandler(squadService *service.SquadService) *SquadHandler {
	return &SquadHandler{squadService: squadService}
}

func (h *SquadHandler) GetSquad(c *gin.Context) {
	userID := c.MustGet("user_id").(int32)
	details, err := h.squadService.GetSquadFull(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, details)
}

type addPlayerRequest struct {
	PlayerID int32  `json:"player_id" binding:"required"`
	Slot     string `json:"slot" binding:"required"`
}

func (h *SquadHandler) AddPlayer(c *gin.Context) {
	userID := c.MustGet("user_id").(int32)
	var req addPlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.squadService.AddPlayer(c.Request.Context(), userID, req.PlayerID, req.Slot)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "jugador añadido con exito"})
}

func (h *SquadHandler) InitSquad(c *gin.Context) {
	userID := c.MustGet("user_id").(int32)
	type initReq struct {
		Name      string `json:"name" binding:"required"`
		Formation string `json:"formation" binding:"required"`
	}
	var req initReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	squad, err := h.squadService.GetOrCreateSquad(c.Request.Context(), userID, req.Name, req.Formation)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, squad)
}
