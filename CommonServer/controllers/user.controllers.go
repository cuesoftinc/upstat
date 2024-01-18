package controllers

import (
	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/models"
	"github.com/CuesoftCloud/upstat/repositories"
	"github.com/CuesoftCloud/upstat/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"log"
	"net/http"
)

type UserController interface {
	ControllerRegister(*gin.Context)
	UpdateUser(*gin.Context)
	DeleteUser(*gin.Context)
	ControllerLogin(*gin.Context)
}

type UserResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type LoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Token   string `json:"token,omitempty"`
	Data    string `json:"data,omitempty"`
}

type userController struct {
	userRepo repositories.UserRepository
}

func NewUserController(db *config.DB) UserController {
	return &userController{
		userRepo: repositories.NewUserRepository(db),
	}
}

func hashPassword(password *string) {
	bytePassword := []byte(*password)
	hashedPassword, _ := bcrypt.GenerateFromPassword(bytePassword, bcrypt.DefaultCost)
	*password = string(hashedPassword)
}
func comparePassword(hashedPassword string, password string) bool {
	byteHashedPassword := []byte(hashedPassword)
	bytePassword := []byte(password)
	err := bcrypt.CompareHashAndPassword(byteHashedPassword, bytePassword)
	if err != nil {
		return false
	}
	return true
}

func (u *userController) ControllerRegister(c *gin.Context) {
	var user models.User

	if err := c.ShouldBindJSON(&user); err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, UserResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}

	// Check if email already exists
	_, err := u.userRepo.GetUser(user.Email)
	if err == nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, UserResponse{
			Success: false,
			Message: "Email already exists",
		})
		return
	}

	hashPassword(&user.Password)
	_, err = u.userRepo.CreateUser(user)
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, UserResponse{
			Success: false,
			Message: "Error creating user",
		})
		return
	}

	c.JSON(http.StatusCreated, UserResponse{
		Success: true,
		Message: "User created successfully",
	})
}

func (u *userController) UpdateUser(c *gin.Context) {
	var user models.User

	if err := c.ShouldBindJSON(&user); err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, UserResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}

	// Get user from DB
	email := c.Param("email")

	// Get user from DB
	dbUser, err := u.userRepo.GetUser(email)

	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, UserResponse{
			Success: false,
			Message: "Error retrieving user",
		})
		return
	}

	// Hash password if it is not empty
	if user.Password != "" {
		hashPassword(&user.Password)
	} else {
		user.Password = dbUser.Password
	}
	var id string
	id = dbUser.Id.Hex()
	_, err = u.userRepo.UpdateUser(id, user)

	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, UserResponse{
			Success: false,
			Message: "Error updating user",
		})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		Success: true,
		Message: "User updated successfully",
		Data:    user,
	})
}

func (u *userController) DeleteUser(c *gin.Context) {
	var user models.User

	if err := c.ShouldBindJSON(&user); err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, UserResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}

	id := c.Param("id")
	_, err := u.userRepo.DeleteUser(id)

	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, UserResponse{
			Success: false,
			Message: "Error deleting user",
		})
		return
	}
	c.JSON(http.StatusOK, UserResponse{
		Success: true,
		Message: "User deleted successfully",
	})
}

func (u *userController) ControllerLogin(c *gin.Context) {
	var user models.User
	var dbUser *models.User

	if err := c.ShouldBindJSON(&user); err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, LoginResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}
	dbUser, err := u.userRepo.GetUser(user.Email)
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, LoginResponse{
			Success: false,
			Message: "Error retrieving user",
		})

		return
	}
	if !comparePassword(dbUser.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, LoginResponse{
			Success: false,
			Message: "Invalid login credentials",
		})
		return
	}

	isTrue := comparePassword(dbUser.Password, user.Password)

	if isTrue {
		token := utils.GenerateToken(dbUser.Id.Hex(), dbUser.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, LoginResponse{
				Success: false,
				Message: "Error retrieving user role",
			})
			return
		}
		c.JSON(http.StatusOK, LoginResponse{
			Success: true,
			Message: "Login successful",
			Token:   token,
		})
		return
	} else {
		c.JSON(http.StatusUnauthorized, LoginResponse{
			Success: false,
			Message: "Invalid Email or Password",
		})
		return
	}
}
