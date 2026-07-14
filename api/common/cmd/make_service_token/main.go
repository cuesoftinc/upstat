package main

import (
    "fmt"
    "os"

    "github.com/CuesoftCloud/upstat/internal/util"
)

func main() {
    userId := "service-observability"
    email := "observability@local"
    if len(os.Args) >= 2 {
        userId = os.Args[1]
    }
    if len(os.Args) >= 3 {
        email = os.Args[2]
    }

    token := util.GenerateNonExpiringToken(userId, email)
    fmt.Println(token)
}
