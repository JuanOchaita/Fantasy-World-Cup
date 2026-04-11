package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"github.com/delta/fantasy-world-cup/internal/repository"
	"github.com/redis/go-redis/v9"
)

const LeaderboardKey = "global_leaderboard"

type ScoringService struct {
	repo *repository.Queries
	rdb  *redis.Client
}

func NewScoringService(repo *repository.Queries, rdb *redis.Client) *ScoringService {
	return &ScoringService{repo: repo, rdb: rdb}
}

func (s *ScoringService) ProcessMatchResult(ctx context.Context, nationA, nationB int32, scoreA, scoreB int32) error {
	var pointsA, pointsB int32

	if scoreA > scoreB {
		pointsA = 3
		pointsB = 0
	} else if scoreA < scoreB {
		pointsA = 0
		pointsB = 3
	} else {
		pointsA = 1
		pointsB = 1
	}

	// Actualizar PostgreSQL masivamente
	if pointsA > 0 {
		err := s.repo.UpdatePointsForNation(ctx, repository.UpdatePointsForNationParams{
			PlayerID:      int32(pointsA), // sqlc asignó este nombre al primer parámetro
			NationalityID: sql.NullInt32{Int32: nationA, Valid: true},
		})
		if err != nil {
			return err
		}
	}

	if pointsB > 0 {
		err := s.repo.UpdatePointsForNation(ctx, repository.UpdatePointsForNationParams{
			PlayerID:      int32(pointsB),
			NationalityID: sql.NullInt32{Int32: nationB, Valid: true},
		})
		if err != nil {
			return err
		}
	}

	// Sincronizar Redis (Actualizar todo el Leaderboard)
	return s.SyncLeaderboardToRedis(ctx)
}

func (s *ScoringService) SyncLeaderboardToRedis(ctx context.Context) error {
	leaderboard, err := s.repo.GetLeaderboard(ctx, repository.GetLeaderboardParams{
		Limit:  500,
		Offset: 0,
	})
	if err != nil {
		return err
	}

	pipe := s.rdb.Pipeline()
	pipe.Del(ctx, LeaderboardKey)

	for _, entry := range leaderboard {
		member := fmt.Sprintf("%s|%s", entry.Username, entry.SquadName)
		pipe.ZAdd(ctx, LeaderboardKey, redis.Z{
			Score:  float64(entry.TotalPoints.Int32),
			Member: member,
		})
	}

	_, err = pipe.Exec(ctx)
	return err
}

func (s *ScoringService) GetLeaderboard(ctx context.Context, start, stop int64) ([]redis.Z, error) {
	res, err := s.rdb.ZRevRangeWithScores(ctx, LeaderboardKey, start, stop).Result()
	if err != nil || len(res) == 0 {
		log.Println("Leaderboard no encontrado en Redis, sincronizando...")
		s.SyncLeaderboardToRedis(ctx)
		return s.rdb.ZRevRangeWithScores(ctx, LeaderboardKey, start, stop).Result()
	}
	return res, nil
}
