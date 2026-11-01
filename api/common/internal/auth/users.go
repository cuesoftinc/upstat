package auth

import "errors"

// User is the account a Google identity signs in to.
type User struct {
	ID    string
	Email string
	Name  string
}

// ErrUserNotFound is what a user store returns for an unknown email.
var ErrUserNotFound = errors.New("user not found")
