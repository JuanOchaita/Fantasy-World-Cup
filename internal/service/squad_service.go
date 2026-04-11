package service

import (
	"context"
	"database/sql"
	"errors"

	"github.com/delta/fantasy-world-cup/internal/repository"
)

const MaxBudget = 100.0 // $100M

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

	// Crear nueva escuadra
	return s.repo.CreateSquad(ctx, repository.CreateSquadParams{
		UserID:     userID,
		SquadName:  name,
		Formation:  sql.NullString{String: formation, Valid: true},
		BudgetUsed: sql.NullInt64{Int64: 0, Valid: true},
	})
}

func (s *SquadService) AddPlayer(ctx context.Context, userID int32, playerID int32, slot string) error {
	squad, err := s.repo.GetSquadByUserID(ctx, userID)
	if err != nil {
		return errors.New("debes crear una escuadra primero")
	}

	player, err := s.repo.GetPlayer(ctx, playerID)
	if err != nil {
		return errors.New("jugador no encontrado")
	}

	price := s.playerService.CalculatePrice(player.ValueEur.Int64)
	newBudget := float64(squad.BudgetUsed.Int64)/100.0 + price

	if newBudget > MaxBudget {
		return errors.New("presupuesto insuficiente")
	}

	// Validar límite por nación
	count, err := s.repo.CountPlayersFromNationInSquad(ctx, repository.CountPlayersFromNationInSquadParams{
		SquadID:       squad.SquadID,
		NationalityID: player.NationalityID,
	})
	if err != nil {
		return err
	}
	if count >= 3 {
		return errors.New("ya tienes 3 jugadores de esta nacionalidad")
	}

	// Añadir jugador
	err = s.repo.AddPlayerToSquad(ctx, repository.AddPlayerToSquadParams{
		SquadID:      squad.SquadID,
		PlayerID:     playerID,
		PositionSlot: sql.NullString{String: slot, Valid: true},
	})
	if err != nil {
		return errors.New("el jugador ya esta en la escuadra")
	}

	// Actualizar presupuesto (guardado en centavos/multiplicado por 100 para evitar floats en DB)
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
