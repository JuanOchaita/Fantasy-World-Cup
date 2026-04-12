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
	return &ScoringService{
		repo: repo,
		rdb:  rdb,
	}
}

type UserRank struct {
	Username  string  `json:"username"`
	SquadName string  `json:"squad_name"`
	Rank      int64   `json:"rank"`
	Score     float64 `json:"score"`
}

type playerContribution struct {
	PlayerID int32
	Points   int32
}

func (s *ScoringService) ProcessMatchResult(
	ctx context.Context,
	nationA, nationB int32,
	scoreA, scoreB int32,
) error {
	teamAName, err := s.resolveNationName(ctx, nationA)
	if err != nil {
		return fmt.Errorf("resolve nation A name: %w", err)
	}

	teamBName, err := s.resolveNationName(ctx, nationB)
	if err != nil {
		return fmt.Errorf("resolve nation B name: %w", err)
	}

	match, err := s.repo.CreateMatch(ctx, repository.CreateMatchParams{
		TeamA:  teamAName,
		TeamB:  teamBName,
		ScoreA: int16(scoreA),
		ScoreB: int16(scoreB),
	})
	if err != nil {
		return fmt.Errorf("create match: %w", err)
	}

	pointsA, pointsB := calculateOutcomePoints(scoreA, scoreB)

	squads, err := s.repo.ListSquadsForScoring(ctx)
	if err != nil {
		return fmt.Errorf("list squads for scoring: %w", err)
	}

	for _, squad := range squads {
		players, err := s.repo.GetSquadPlayers(ctx, squad.SquadID)
		if err != nil {
			return fmt.Errorf("get squad players for squad %d: %w", squad.SquadID, err)
		}

		matchPoints, contributions := calculateSquadMatchPoints(players, nationA, nationB, pointsA, pointsB)
		if matchPoints <= 0 {
			continue
		}

		totalAfterMatch := getInt32FromNull(squad.TotalPoints) + matchPoints

		_, err = s.repo.CreateMatchUserPoints(ctx, repository.CreateMatchUserPointsParams{
			MatchID:               match.MatchID,
			UserID:                squad.UserID,
			PointsEarned:          matchPoints,
			TotalPointsAfterMatch: totalAfterMatch,
		})
		if err != nil {
			return fmt.Errorf("create match_user_points for user %d: %w", squad.UserID, err)
		}

		for _, contribution := range contributions {
			_, err = s.repo.CreateMatchUserPlayerPoints(ctx, repository.CreateMatchUserPlayerPointsParams{
				MatchID:      match.MatchID,
				UserID:       squad.UserID,
				PlayerID:     contribution.PlayerID,
				PointsEarned: contribution.Points,
			})
			if err != nil {
				return fmt.Errorf(
					"create match_user_player_points for user %d and player %d: %w",
					squad.UserID,
					contribution.PlayerID,
					err,
				)
			}
		}
	}

	// Mantiene la lógica ya existente para actualizar los puntos acumulados.
	if pointsA > 0 {
		if err := s.repo.UpdatePointsForNation(ctx, repository.UpdatePointsForNationParams{
			PlayerID:      pointsA,
			NationalityID: sql.NullInt32{Int32: nationA, Valid: true},
		}); err != nil {
			return fmt.Errorf("update points for nation A: %w", err)
		}
	}

	if pointsB > 0 {
		if err := s.repo.UpdatePointsForNation(ctx, repository.UpdatePointsForNationParams{
			PlayerID:      pointsB,
			NationalityID: sql.NullInt32{Int32: nationB, Valid: true},
		}); err != nil {
			return fmt.Errorf("update points for nation B: %w", err)
		}
	}

	if err := s.SyncLeaderboardToRedis(ctx); err != nil {
		return fmt.Errorf("sync leaderboard to redis: %w", err)
	}

	return nil
}

func calculateOutcomePoints(scoreA, scoreB int32) (pointsA, pointsB int32) {
	switch {
	case scoreA > scoreB:
		return 3, 0
	case scoreA < scoreB:
		return 0, 3
	default:
		return 1, 1
	}
}

func calculateSquadMatchPoints(
	players []repository.GetSquadPlayersRow,
	nationA, nationB int32,
	pointsA, pointsB int32,
) (int32, []playerContribution) {
	var total int32
	contributions := make([]playerContribution, 0)

	for _, player := range players {
		if !player.NationalityID.Valid {
			continue
		}

		var playerPoints int32

		switch player.NationalityID.Int32 {
		case nationA:
			playerPoints = pointsA
		case nationB:
			playerPoints = pointsB
		default:
			continue
		}

		if playerPoints <= 0 {
			continue
		}

		total += playerPoints
		contributions = append(contributions, playerContribution{
			PlayerID: player.PlayerID,
			Points:   playerPoints,
		})
	}

	return total, contributions
}

func (s *ScoringService) resolveNationName(ctx context.Context, nationID int32) (string, error) {
	const pageSize int32 = 2000
	var offset int32 = 0

	for {
		players, err := s.repo.ListPlayers(ctx, repository.ListPlayersParams{
			Limit:  pageSize,
			Offset: offset,
		})
		if err != nil {
			return "", err
		}

		if len(players) == 0 {
			break
		}

		for _, player := range players {
			if player.NationalityID.Valid && player.NationalityID.Int32 == nationID {
				if player.NationalityName.Valid && player.NationalityName.String != "" {
					return player.NationalityName.String, nil
				}
			}
		}

		if len(players) < int(pageSize) {
			break
		}

		offset += pageSize
	}

	return fmt.Sprintf("%d", nationID), nil
}

func getInt32FromNull(v sql.NullInt32) int32 {
	if v.Valid {
		return v.Int32
	}
	return 0
}

func (s *ScoringService) SyncLeaderboardToRedis(ctx context.Context) error {
	const pageSize int32 = 500

	pipe := s.rdb.Pipeline()
	pipe.Del(ctx, LeaderboardKey)

	offset := int32(0)

	for {
		rows, err := s.repo.GetLeaderboard(ctx, repository.GetLeaderboardParams{
			Limit:  pageSize,
			Offset: offset,
		})
		if err != nil {
			return fmt.Errorf("load leaderboard from database: %w", err)
		}

		for _, entry := range rows {
			member := entry.Username
			score := float64(0)

			if entry.TotalPoints.Valid {
				score = float64(entry.TotalPoints.Int32)
			}

			pipe.ZAdd(ctx, LeaderboardKey, redis.Z{
				Score:  score,
				Member: member,
			})
		}

		if len(rows) < int(pageSize) {
			break
		}

		offset += pageSize
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("execute redis pipeline: %w", err)
	}

	return nil
}

func (s *ScoringService) syncLeaderboardOrFail(ctx context.Context) error {
	if err := s.SyncLeaderboardToRedis(ctx); err != nil {
		return err
	}
	return nil
}

func (s *ScoringService) GetLeaderboard(ctx context.Context, start, stop int64) ([]redis.Z, error) {
	res, err := s.rdb.ZRevRangeWithScores(ctx, LeaderboardKey, start, stop).Result()
	if err == nil && len(res) > 0 {
		return res, nil
	}

	log.Println("Leaderboard no encontrado en Redis, sincronizando desde PostgreSQL...")

	if syncErr := s.syncLeaderboardOrFail(ctx); syncErr != nil {
		return nil, syncErr
	}

	return s.rdb.ZRevRangeWithScores(ctx, LeaderboardKey, start, stop).Result()
}

func (s *ScoringService) GetUserRank(ctx context.Context, username, squadName string) (UserRank, error) {
	member := username

	rank, err := s.rdb.ZRevRank(ctx, LeaderboardKey, member).Result()
	if err != nil {
		log.Println("Rank no encontrado en Redis, sincronizando desde PostgreSQL...")

		if syncErr := s.syncLeaderboardOrFail(ctx); syncErr != nil {
			return UserRank{}, syncErr
		}

		rank, err = s.rdb.ZRevRank(ctx, LeaderboardKey, member).Result()
		if err != nil {
			return UserRank{}, err
		}
	}

	score, err := s.rdb.ZScore(ctx, LeaderboardKey, member).Result()
	if err != nil {
		if syncErr := s.syncLeaderboardOrFail(ctx); syncErr != nil {
			return UserRank{}, syncErr
		}

		score, err = s.rdb.ZScore(ctx, LeaderboardKey, member).Result()
		if err != nil {
			return UserRank{}, err
		}
	}

	squadNameFromDB := squadName
	user, err := s.repo.GetUserByUsername(ctx, username)
	if err == nil {
		squad, squadErr := s.repo.GetSquadByUserID(ctx, user.UserID)
		if squadErr == nil && squad.SquadName != "" {
			squadNameFromDB = squad.SquadName
		}
	}

	return UserRank{
		Username:  username,
		SquadName: squadNameFromDB,
		Rank:      rank + 1,
		Score:     score,
	}, nil
}