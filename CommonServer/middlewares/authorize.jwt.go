package middlewares

import (
	"fmt"
	"net/http"

	"github.com/CuesoftCloud/upstat/utils"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthorizeJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		const BearerSchema = "Bearer "

		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		}

		tokenString := authHeader[len(BearerSchema):]

		if token, err := utils.ValidateToken(tokenString); err != nil {
			fmt.Println("token", token, err.Error())
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Token"})
		} else {
			if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
				// Set with it type assertion to uint
				c.Set("jwtUserId", claims["userId"])
				c.Set("jwtEmail", claims["email"])
			} else {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Token"})
			}
		}

	}
}
