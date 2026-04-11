package handler

import (
	"net/http"
	"strconv"

	"github.com/delta/fantasy-world-cup/internal/service"
	"github.com/gin-gonic/gin"
)

type ScoringHandler struct {
	scoringService *service.ScoringService
}

func NewScoringHandler(scoringService *service.ScoringService) *ScoringHandler {
	return &ScoringHandler{scoringService: scoringService}
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
