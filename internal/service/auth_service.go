package service

import (
	"context"
	"errors"
	"os"
	"time"

	"github.com/delta/fantasy-world-cup/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	repo  *repository.Queries
	rdb   *redis.Client
	jwtKey []byte
}

func NewAuthService(repo *repository.Queries, rdb *redis.Client) *AuthService {
	return &AuthService{
		repo:  repo,
		rdb:   rdb,
		jwtKey: []byte(os.Getenv("JWT_SECRET")),
	}
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func (s *AuthService) Register(ctx context.Context, username, email, password string) (repository.User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return repository.User{}, err
	}

	return s.repo.CreateUser(ctx, repository.CreateUserParams{
		Username:     username,
		Email:        email,
		PasswordHash: string(hashedPassword),
	})
}

func (s *AuthService) Login(ctx context.Context, email, password string) (TokenPair, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return TokenPair{}, errors.New("credenciales invalidas")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return TokenPair{}, errors.New("credenciales invalidas")
	}

	return s.GenerateTokenPair(ctx, user.UserID)
}

func (s *AuthService) GenerateTokenPair(ctx context.Context, userID int32) (TokenPair, error) {
	// Access Token (15 min)
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Minute * 15).Unix(),
	})
	at, err := accessToken.SignedString(s.jwtKey)
	if err != nil {
		return TokenPair{}, err
	}

	// Refresh Token (1 mes)
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24 * 30).Unix(),
	})
	rt, err := refreshToken.SignedString(s.jwtKey)
	if err != nil {
		return TokenPair{}, err
	}

	// Almacenar Refresh Token en Redis
	err = s.rdb.Set(ctx, rt, userID, time.Hour*24*30).Err()
	if err != nil {
		return TokenPair{}, err
	}

	return TokenPair{AccessToken: at, RefreshToken: rt}, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (TokenPair, error) {
	// 1. Verificar si el token existe en Redis
	userID, err := s.rdb.Get(ctx, refreshToken).Int()
	if err != nil {
		return TokenPair{}, errors.New("refresh token invalido o expirado")
	}

	// 2. Opcional: Validar JWT (firma y expiración)
	token, err := jwt.Parse(refreshToken, func(token *jwt.Token) (interface{}, error) {
		return s.jwtKey, nil
	})
	if err != nil || !token.Valid {
		return TokenPair{}, errors.New("refresh token invalido")
	}

	// 3. Eliminar el token viejo (Estrategia de Rotación)
	s.rdb.Del(ctx, refreshToken)

	// 4. Generar nuevo par
	return s.GenerateTokenPair(ctx, int32(userID))
}
