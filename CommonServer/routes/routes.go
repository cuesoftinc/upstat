package routes

import (
	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/controllers"
	"github.com/gin-gonic/gin"
)

// SetupRoutes is a function that sets up the routes for the server
func SetupRoutes(server *gin.Engine, db *config.DB) {
	userController := controllers.NewUserController(db)

	server.GET("/ping", controllers.ControllerPing)

	apiRoutes := server.Group("/api")
	userRoutes := apiRoutes.Group("/v1/auth")
	{
		userRoutes.POST("/signup", userController.ControllerRegister)
		userRoutes.POST("/signin", userController.ControllerLogin)
	}
}
