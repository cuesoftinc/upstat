package main

import (
	"fmt"
	"log"
	"os"

	"github.com/CuesoftCloud/upstat/middlewares"

	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/routes"
	"github.com/gin-gonic/gin"
)

// main is the entry point for the server
func main() {
	config.LoadEnv()
	var db *config.DB

	db = config.NewDBHandler()

	server := gin.New()
	server.Use(gin.Logger())
	server.Use(middlewares.Cors())
	routes.SetupRoutes(server, db)
	err := server.Run(os.Getenv("PORT"))
	if err != nil {
		log.Fatalln(fmt.Sprintf("Error Starting Server: %v", err))
		return
	}
}
