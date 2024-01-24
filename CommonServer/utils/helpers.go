package utils

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"github.com/jordan-wright/email"
	"golang.org/x/crypto/bcrypt"
	"net/smtp"
	"os"
)

// HashPassword function to hash a password
func HashPassword(password *string) (string, error) {
	bytePassword := []byte(*password)
	hashPassword, _ := bcrypt.GenerateFromPassword(bytePassword, bcrypt.DefaultCost)
	*password = string(hashPassword)
	return *password, nil
}

// ComparePassword function to compare a hashed password with a password
func ComparePassword(hashedPassword, password string) bool {
	byteHashedPassword := []byte(hashedPassword)
	bytePassword := []byte(password)
	err := bcrypt.CompareHashAndPassword(byteHashedPassword, bytePassword)
	if err != nil {
		return false
	}
	return true
}

// SendEmail function to send an email
func SendEmail(to, subject, body string) error {
	e := email.NewEmail()
	e.From = "Upstat <bright.olawale@cuesoft.io>"
	e.To = []string{to}
	e.Subject = subject
	e.Text = []byte(body)
	err := e.Send("smtp.mailgun.org:587", smtp.PlainAuth("", os.Getenv("SMTP_USERNAME"), os.Getenv("SMTP_PASSWORD"), "smtp.mailgun.org"))
	if err != nil {
		panic(err)
	}
	return err
}

func GenerateRandomToken() (string, error) {
	var token uint32
	err := binary.Read(rand.Reader, binary.LittleEndian, &token)

	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", token), nil
}
