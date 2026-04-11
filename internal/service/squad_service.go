package service

import (
	"context"
	"database/sql"
	"errors"

	"github.com/delta/fantasy-world-cup/internal/repository"
)

const MaxBudget = 100.0 // $100M
const MaxSquadSize = 11

type SquadService struct {
	repo          *repository.Queries
	playerService *PlayerService
}

func NewSquadService(repo *repository.Queries, playerService *PlayerService) *SquadService {
	return &SquadService{repo: repo, playerService: playerService}
}

type SquadDetails struct {
	Squad   repository.Squad          `json:"squad"`
	Players []repository.GetSquadPlayersRow `json:"players"`
}

func (s *SquadService) GetOrCreateSquad(ctx context.Context, userID int32, name, formation string) (repository.Squad, error) {
	squad, err := s.repo.GetSquadByUserID(ctx, userID)
	if err == nil {
		return squad, nil
	}

	return s.repo.CreateSquad(ctx, repository.CreateSquadParams{
		UserID:     userID,
		SquadName:  name,
		Formation:  sql.NullString{String: formation, Valid: true},
		BudgetUsed: sql.NullInt64{Int64: 0, Valid: true},
	})
}

func (s *SquadService) ChangeFormation(ctx context.Context, userID int32, formation string) (repository.Squad, error) {
	squad, err := s.repo.GetSquadByUserID(ctx, userID)
	if err != nil {
		return repository.Squad{}, errors.New("escuadra no encontrada")
	}

	return s.repo.UpdateSquadFormation(ctx, repository.UpdateSquadFormationParams{
		SquadID:   squad.SquadID,
		Formation: sql.NullString{String: formation, Valid: true},
	})
}

func (s *SquadService) AddPlayer(ctx context.Context, userID int32, playerID int32, slot string) error {
	squad, err := s.repo.GetSquadByUserID(ctx, userID)
	if err != nil {
		return errors.New("debes crear una escuadra primero")
	}

	// 1. Validar limite de 11 jugadores
	countTotal, err := s.repo.CountPlayersInSquad(ctx, squad.SquadID)
	if err != nil {
		return err
	}
	if countTotal >= MaxSquadSize {
		return errors.New("la escuadra ya tiene los 11 jugadores reglamentarios")
	}

	player, err := s.repo.GetPlayer(ctx, playerID)
	if err != nil {
		return errors.New("jugador no encontrado")
	}

	// 2. Validar presupuesto
	price := s.playerService.CalculatePrice(player.ValueEur.Int64)
	newBudget := float64(squad.BudgetUsed.Int64)/100.0 + price

	if newBudget > MaxBudget {
		return errors.New("presupuesto insuficiente")
	}

	// 3. Validar limite por nacion
	countNation, err := s.repo.CountPlayersFromNationInSquad(ctx, repository.CountPlayersFromNationInSquadParams{
		SquadID:       squad.SquadID,
		NationalityID: player.NationalityID,
	})
	if err != nil {
		return err
	}
	if countNation >= 3 {
		return errors.New("ya tienes 3 jugadores de esta nacionalidad")
	}

	// Añadir jugador
	err = s.repo.AddPlayerToSquad(ctx, repository.AddPlayerToSquadParams{
		SquadID:      squad.SquadID,
		PlayerID:     playerID,
		PositionSlot: sql.NullString{String: slot, Valid: true},
	})
	if err != nil {
		return errors.New("el jugador ya esta en la escuadra o el slot esta ocupado")
	}

	// Actualizar presupuesto
	_, err = s.repo.UpdateSquadBudget(ctx, repository.UpdateSquadBudgetParams{
		SquadID:    squad.SquadID,
		BudgetUsed: sql.NullInt64{Int64: int64(newBudget * 100), Valid: true},
	})

	return err
}

func (s *SquadService) GetSquadFull(ctx context.Context, userID int32) (SquadDetails, error) {
	squad, err := s.repo.GetSquadByUserID(ctx, userID)
	if err != nil {
		return SquadDetails{}, errors.New("escuadra no encontrada")
	}

	players, err := s.repo.GetSquadPlayers(ctx, squad.SquadID)
	if err != nil {
		return SquadDetails{}, err
	}

	return SquadDetails{
		Squad:   squad,
		Players: players,
	}, nil
}
