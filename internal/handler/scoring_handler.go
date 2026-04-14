package handler

import (
	"database/sql"
	"fmt"
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
	return &ScoringHandler{
		scoringService: scoringService,
		repo:           repo,
	}
}

type matchResultRequest struct {
	NationAID int32 `json:"nation_a_id" binding:"required"`
	NationBID int32 `json:"nation_b_id" binding:"required"`
	ScoreA    int32 `json:"score_a"`
	ScoreB    int32 `json:"score_b"`
}

type leaderboardEntryResponse struct {
	Rank        int64   `json:"rank"`
	Username    string  `json:"username"`
	TotalPoints float64 `json:"total_points"`
}

type myRankResponse struct {
	Username  string  `json:"username"`
	SquadName string  `json:"squad_name"`
	Rank      int64   `json:"rank"`
	Score     float64 `json:"score"`
	GameWins  int32   `json:"game_wins"`
	Message   string  `json:"message,omitempty"`
}

func (h *ScoringHandler) PostResult(c *gin.Context) {
	var req matchResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.NationAID <= 0 || req.NationBID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nation_a_id y nation_b_id deben ser mayores que 0"})
		return
	}

	if req.NationAID == req.NationBID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nation_a_id y nation_b_id deben ser diferentes"})
		return
	}

	if req.ScoreA < 0 || req.ScoreB < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "los goles no pueden ser negativos"})
		return
	}

	if err := h.scoringService.ProcessMatchResult(
		c.Request.Context(),
		req.NationAID,
		req.NationBID,
		req.ScoreA,
		req.ScoreB,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "resultado procesado y puntos actualizados"})
}

func (h *ScoringHandler) GetLeaderboard(c *gin.Context) {
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "10")

	page, err := strconv.ParseInt(pageStr, 10, 64)
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.ParseInt(limitStr, 10, 64)
	if err != nil || limit < 1 {
		limit = 10
	}

	if limit > 100 {
		limit = 100
	}

	start := (page - 1) * limit
	stop := start + limit - 1

	res, err := h.scoringService.GetLeaderboard(c.Request.Context(), start, stop)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al obtener leaderboard"})
		return
	}

	items := make([]leaderboardEntryResponse, 0, len(res))
	for i, entry := range res {
		username := fmt.Sprint(entry.Member)
		items = append(items, leaderboardEntryResponse{
			Rank:        start + int64(i) + 1,
			Username:    username,
			TotalPoints: entry.Score,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"page":  page,
		"limit": limit,
		"items": items,
	})
}

func (h *ScoringHandler) GetMyRank(c *gin.Context) {
	userIDRaw, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "usuario no autenticado"})
		return
	}

	userID, ok := normalizeUserID(userIDRaw)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "formato inválido de user_id en contexto"})
		return
	}

	squad, err := h.repo.GetSquadByUserID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "escuadra no encontrada"})
		return
	}

	user, err := h.repo.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al obtener datos de usuario"})
		return
	}

	rankInfo, err := h.scoringService.GetUserRank(c.Request.Context(), user.Username, squad.SquadName)
	history, historyErr := h.repo.GetUserScoringHistory(c.Request.Context(), repository.GetUserScoringHistoryParams{
		UserID: userID,
		Limit:  500,
		Offset: 0,
	})
	gameWins := int32(0)
	if historyErr == nil {
		for _, row := range history {
			if row.PointsEarned > 0 {
				gameWins++
			}
		}
	}
	if err != nil {
		c.JSON(http.StatusOK, myRankResponse{
			Username:  user.Username,
			SquadName: squad.SquadName,
			Rank:      0,
			Score:     nullInt32ToFloat64(squad.TotalPoints),
			GameWins:  gameWins,
			Message:   "aun no estas en el ranking de Redis (sincronizando...)",
		})
		return
	}

	c.JSON(http.StatusOK, myRankResponse{
		Username:  rankInfo.Username,
		SquadName: rankInfo.SquadName,
		Rank:      rankInfo.Rank,
		Score:     rankInfo.Score,
		GameWins:  gameWins,
	})
}

func normalizeUserID(v any) (int32, bool) {
	switch id := v.(type) {
	case int32:
		return id, true
	case int:
		return int32(id), true
	case int64:
		return int32(id), true
	case uint:
		return int32(id), true
	case uint32:
		return int32(id), true
	case uint64:
		return int32(id), true
	case float64:
		return int32(id), true
	default:
		return 0, false
	}
}

func nullInt32ToFloat64(v sql.NullInt32) float64 {
	if v.Valid {
		return float64(v.Int32)
	}
	return 0
}