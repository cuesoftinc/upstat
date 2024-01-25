package controllers

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/models"
	"github.com/CuesoftCloud/upstat/repositories"
	"github.com/CuesoftCloud/upstat/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type UserController interface {
	ControllerRegister(*gin.Context)
	UpdateUser(*gin.Context)
	DeleteUser(*gin.Context)
	ControllerLogin(*gin.Context)
	ControllerForgotPassword(*gin.Context)
	ControllerResetPassword(*gin.Context)
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
	userRepo  repositories.UserRepository
	tokenRepo repositories.TokenRepository
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

func (u *userController) ControllerForgotPassword(c *gin.Context) {
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
	email := user.Email

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

	// Create a token
	token, err := utils.GenerateRandomToken()
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, UserResponse{
			Success: false,
			Message: "Error Generating Token",
		})
		return
	}

	hashedToken, _ := utils.HashPassword(&token)
	// Save to db
	_, err = u.tokenRepo.CreateToken(models.Token{
		UserID: email,
		Token:  hashedToken,
	})

	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, UserResponse{
			Success: false,
			Message: "Failed to create token",
		})
		return
	}

	// Generate a link
	link := os.Getenv("BASE_URL") + "/reset-verify/" + token

	// Send email
	err = utils.SendEmail(dbUser.Email, "Reset Password", link)

	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, UserResponse{
			Success: false,
			Message: "Error sending email",
		})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		Success: true,
		Message: "Email sent successfully",
	})
}

func (u *userController) ControllerResetPassword(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, UserResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}
	token := c.Param("token")

	result, err := u.tokenRepo.GetToken(user.Email)
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusNotFound, UserResponse{
			Success: false,
			Message: "Invalid email",
		})
		return
	}

	timeDifference := time.Since(result.CreatedAt).Minutes()
	if timeDifference > 10 {
		c.JSON(http.StatusBadRequest, UserResponse{
			Success: false,
			Message: "Token expired",
		})
		return
	}

	hashedToken := result.Token
	isValid := utils.ComparePassword(hashedToken, token)
	if !isValid {
		c.JSON(http.StatusBadRequest, UserResponse{
			Success: false,
			Message: "Invalid token",
		})
		return
	}

	hashPassword(&user.Password)
	_, err = u.userRepo.UpdateUser(user.Email, user)
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, UserResponse{
			Success: false,
			Message: "Error updating password",
		})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		Success: true,
		Message: "Password updated successfully",
	})
}
