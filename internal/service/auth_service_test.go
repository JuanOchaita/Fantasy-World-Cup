package service

import (
	"testing"
	"golang.org/x/crypto/bcrypt"
)

func TestAuthService_Register_Hashing(t *testing.T) {
	password := "secreto123"
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("error al generar hash: %v", err)
	}

	err = bcrypt.CompareHashAndPassword(hashedPassword, []byte(password))
	if err != nil {
		t.Errorf("el hash no coincide con la contraseña original")
	}

	err = bcrypt.CompareHashAndPassword(hashedPassword, []byte("incorrecta"))
	if err == nil {
		t.Errorf("se acepto una contraseña incorrecta")
	}
}
