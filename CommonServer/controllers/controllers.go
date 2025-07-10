package controllers

import (
	"github.com/gin-gonic/gin"
)

// ControllerPing is a function that handles the /ping route
func ControllerPing(ctx *gin.Context) {
	// Controller logic goes here
	ctx.JSON(200, gin.H{"message": "pong"})
}
