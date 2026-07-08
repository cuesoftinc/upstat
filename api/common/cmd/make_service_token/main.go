package main

import (
    "fmt"
    "os"

    "github.com/CuesoftCloud/upstat/utils"
)

func main() {
    userId := "service-reliability"
    email := "reliability-service@local"
    if len(os.Args) >= 2 {
        userId = os.Args[1]
    }
    if len(os.Args) >= 3 {
        email = os.Args[2]
    }

    token := utils.GenerateNonExpiringToken(userId, email)
    fmt.Println(token)
}
