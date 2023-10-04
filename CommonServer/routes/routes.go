package routes

import (
	"github.com/CuesoftCloud/upstat/controllers"
	"github.com/gin-gonic/gin"
)

// SetupRoutes is a function that sets up the routes for the server
func SetupRoutes(server *gin.Engine) {
	server.GET("/ping", controllers.ControllerPing)
}
