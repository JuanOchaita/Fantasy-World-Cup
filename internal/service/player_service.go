package service

import (
	"context"
	"database/sql"
	"math"

	"github.com/delta/fantasy-world-cup/internal/repository"
)

// FantasyPriceEurDivisor matches the UI: fantasy price (£m) = value_eur / 10_000_000.
const FantasyPriceEurDivisor = 10_000_000.0

type PlayerWithPrice struct {
	repository.Player
	FantasyPrice float64 `json:"fantasy_price"`
}

type PlayerService struct {
	repo *repository.Queries
}

func NewPlayerService(repo *repository.Queries) *PlayerService {
	return &PlayerService{repo: repo}
}

func (s *PlayerService) CalculatePrice(valueEur int64) float64 {
	if valueEur <= 0 {
		return 0
	}
	price := float64(valueEur) / FantasyPriceEurDivisor
	return math.Round(price*100) / 100
}

func (s *PlayerService) Search(ctx context.Context, query string, limit, offset int32) ([]PlayerWithPrice, error) {
	var players []repository.Player
	var err error

	if query == "" {
		players, err = s.repo.ListPlayers(ctx, repository.ListPlayersParams{
			Limit:  limit,
			Offset: offset,
		})
	} else {
		players, err = s.repo.SearchPlayers(ctx, repository.SearchPlayersParams{
			ShortName: sql.NullString{String: "%" + query + "%", Valid: true},
			Limit:     limit,
			Offset:    offset,
		})
	}

	if err != nil {
		return nil, err
	}

	result := make([]PlayerWithPrice, len(players))
	for i, p := range players {
		result[i] = PlayerWithPrice{
			Player:       p,
			FantasyPrice: s.CalculatePrice(p.ValueEur.Int64),
		}
	}

	return result, nil
}
