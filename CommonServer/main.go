package main

import (
	"fmt"

	"github.com/CuesoftCloud/upstat/routes"
	"github.com/gin-gonic/gin"
)

// main is the entry point for the server
func main() {
	server := gin.Default()
	routes.SetupRoutes(server)
	err := server.Run(":8080")
	if err != nil {
		fmt.Println(err)
		return
	}
}
