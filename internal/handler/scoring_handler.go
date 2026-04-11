package handler

import (
	"net/http"
	"strconv"

	"github.com/delta/fantasy-world-cup/internal/repository"
	"github.com/delta/fantasy-world-cup/internal/service"
	"github.com/gin-gonic/gin"
)

type ScoringHandler struct {
	scoringService *service.ScoringService
	repo           *repository.Queries
}

func NewScoringHandler(scoringService *service.ScoringService, repo *repository.Queries) *ScoringHandler {
	return &ScoringHandler{scoringService: scoringService, repo: repo}
}

type matchResultRequest struct {
	NationAID int32 `json:"nation_a_id" binding:"required"`
	NationBID int32 `json:"nation_b_id" binding:"required"`
	ScoreA    int32 `json:"score_a"`
	ScoreB    int32 `json:"score_b"`
}

func (h *ScoringHandler) PostResult(c *gin.Context) {
	var req matchResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.scoringService.ProcessMatchResult(c.Request.Context(), req.NationAID, req.NationBID, req.ScoreA, req.ScoreB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "resultado procesado y puntos actualizados"})
}

func (h *ScoringHandler) GetLeaderboard(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "10")
	limit, _ := strconv.ParseInt(limitStr, 10, 64)

	res, err := h.scoringService.GetLeaderboard(c.Request.Context(), 0, limit-1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al obtener leaderboard"})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *ScoringHandler) GetMyRank(c *gin.Context) {
	userID := c.MustGet("user_id").(int32)

	// 1. Obtener datos de escuadra
	squad, err := h.repo.GetSquadByUserID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "escuadra no encontrada"})
		return
	}

	// 2. Obtener datos de usuario
	user, err := h.repo.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al obtener datos de usuario"})
		return
	}

	// 3. Consultar Redis para el ranking
	res, err := h.scoringService.GetUserRank(c.Request.Context(), user.Username, squad.SquadName)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"username":   user.Username,
			"squad_name": squad.SquadName,
			"rank":       "N/A",
			"score":      squad.TotalPoints.Int32,
			"message":    "aun no estas en el ranking de Redis (sincronizando...)",
		})
		return
	}

	c.JSON(http.StatusOK, res)
}
