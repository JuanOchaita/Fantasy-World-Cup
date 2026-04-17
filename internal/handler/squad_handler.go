package handler

import (
	"net/http"
	"strconv"

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

type removePlayerRequest struct {
	PlayerID int32 `json:"player_id"`
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

func (h *SquadHandler) RemovePlayer(c *gin.Context) {
	userID := c.MustGet("user_id").(int32)

	var playerID int32
	if raw := c.Param("player_id"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "player_id invalido"})
			return
		}
		playerID = int32(parsed)
	} else {
		var req removePlayerRequest
		if err := c.ShouldBindJSON(&req); err != nil || req.PlayerID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "player_id es requerido"})
			return
		}
		playerID = req.PlayerID
	}

	if err := h.squadService.RemovePlayer(c.Request.Context(), userID, playerID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "jugador eliminado con exito"})
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

func (h *SquadHandler) ChangeFormation(c *gin.Context) {
	userID := c.MustGet("user_id").(int32)
	type changeReq struct {
		Formation string `json:"formation" binding:"required"`
	}
	var req changeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	squad, err := h.squadService.ChangeFormation(c.Request.Context(), userID, req.Formation)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, squad)
}

func (h *SquadHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(int32)
	type updateReq struct {
		Name      string `json:"name" binding:"required"`
		Formation string `json:"formation" binding:"required"`
	}
	var req updateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	squad, err := h.squadService.UpdateProfile(c.Request.Context(), userID, req.Name, req.Formation)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, squad)
}
