package service

import (
	"context"
	"database/sql"
	"errors"

	"github.com/delta/fantasy-world-cup/internal/repository"
)

const MaxBudget = 100.0
const MaxSquadSize = 11

type SquadService struct {
	repo          *repository.Queries
	playerService *PlayerService
}

func NewSquadService(repo *repository.Queries, playerService *PlayerService) *SquadService {
	return &SquadService{repo: repo, playerService: playerService}
}

// --- Response DTOs (safe for JSON, no sql.Null* types) ---

type SquadDTO struct {
	SquadID     int32  `json:"squad_id"`
	UserID      int32  `json:"user_id"`
	SquadName   string `json:"squad_name"`
	Formation   string `json:"formation"`
	BudgetUsed  int64  `json:"budget_used"`
	TotalPoints int64  `json:"total_points"`
}

type SquadPlayerDTO struct {
	PlayerID        int32  `json:"player_id"`
	ShortName       string `json:"short_name"`
	LongName        string `json:"long_name"`
	PlayerPositions string `json:"player_positions"`
	NationalityName string `json:"nationality_name"`
	ClubName        string `json:"club_name"`
	PositionSlot    string `json:"position_slot"`
	ValueEur        int64  `json:"value_eur"`
}

type SquadDetails struct {
	Squad   SquadDTO         `json:"squad"`
	Players []SquadPlayerDTO `json:"players"`
}

func toSquadDTO(s repository.Squad) SquadDTO {
	formation := ""
	if s.Formation != nil {
		formation = *s.Formation
	}
	budgetUsed := int64(0)
	if s.BudgetUsed != nil {
		budgetUsed = *s.BudgetUsed
	}
	totalPoints := int64(0)
	if s.TotalPoints != nil {
		totalPoints = *s.TotalPoints
	}
	return SquadDTO{
		SquadID:     s.SquadID,
		UserID:      s.UserID,
		SquadName:   s.SquadName,
		Formation:   formation,
		BudgetUsed:  budgetUsed,
		TotalPoints: totalPoints,
	}
}

func toPlayerDTO(p repository.GetSquadPlayersRow) SquadPlayerDTO {
	nullStr := func(s interface{ String() string }) string { return "" }
	_ = nullStr

	shortName := ""
	if p.ShortName != nil {
		shortName = *p.ShortName
	}
	longName := ""
	if p.LongName != nil {
		longName = *p.LongName
	}
	positions := ""
	if p.PlayerPositions != nil {
		positions = *p.PlayerPositions
	}
	nationality := ""
	if p.NationalityName != nil {
		nationality = *p.NationalityName
	}
	club := ""
	if p.ClubName != nil {
		club = *p.ClubName
	}
	slot := ""
	if p.PositionSlot != nil {
		slot = *p.PositionSlot
	}
	valueEur := int64(0)
	if p.ValueEur != nil {
		valueEur = *p.ValueEur
	}
	return SquadPlayerDTO{
		PlayerID:        p.PlayerID,
		ShortName:       shortName,
		LongName:        longName,
		PlayerPositions: positions,
		NationalityName: nationality,
		ClubName:        club,
		PositionSlot:    slot,
		ValueEur:        valueEur,
	}
}

// --- Service methods ---

func (s *SquadService) GetOrCreateSquad(ctx context.Context, userID int32, name, formation string) (repository.Squad, error) {
	squad, err := s.repo.GetSquadByUserID(ctx, userID)
	if err == nil {
		return squad, nil
	}

	budget := int64(0)
	return s.repo.CreateSquad(ctx, repository.CreateSquadParams{
		UserID:     userID,
		SquadName:  name,
		Formation:  &formation,
		BudgetUsed: &budget,
	})
}

func (s *SquadService) ChangeFormation(ctx context.Context, userID int32, formation string) (repository.Squad, error) {
	squad, err := s.repo.GetSquadByUserID(ctx, userID)
	if err != nil {
		return repository.Squad{}, errors.New("escuadra no encontrada")
	}

	return s.repo.UpdateSquadFormation(ctx, repository.UpdateSquadFormationParams{
		SquadID:   squad.SquadID,
		Formation: &formation,
	})
}

func (s *SquadService) AddPlayer(ctx context.Context, userID int32, playerID int32, slot string) error {
	squad, err := s.repo.GetSquadByUserID(ctx, userID)
	if err != nil {
		return errors.New("debes crear una escuadra primero")
	}

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

	price := s.playerService.CalculatePrice(player.ValueEur.Int64)
	currentBudget := int64(0)
	if squad.BudgetUsed != nil {
		currentBudget = *squad.BudgetUsed
	}
	newBudget := float64(currentBudget)/100.0 + price
	if newBudget > MaxBudget {
		return errors.New("presupuesto insuficiente")
	}

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

	err = s.repo.AddPlayerToSquad(ctx, repository.AddPlayerToSquadParams{
		SquadID:      squad.SquadID,
		PlayerID:     playerID,
		PositionSlot: sql.NullString{String: slot, Valid: true},
	})
	if err != nil {
		return errors.New("el jugador ya esta en la escuadra o el slot esta ocupado")
	}

	value := int64(newBudget * 100)
	_, err = s.repo.UpdateSquadBudget(ctx, repository.UpdateSquadBudgetParams{
		SquadID:    squad.SquadID,
		BudgetUsed: &value,
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

	playerDTOs := make([]SquadPlayerDTO, len(players))
	for i, p := range players {
		playerDTOs[i] = toPlayerDTO(p)
	}

	return SquadDetails{
		Squad:   toSquadDTO(squad),
		Players: playerDTOs,
	}, nil
}