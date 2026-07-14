package main

import (
	"fmt"
	"os"

	"github.com/cuesoftinc/upstat/api/common/internal/util"
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

	token, err := util.GenerateNonExpiringToken(userId, email)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	fmt.Println(token)
}
