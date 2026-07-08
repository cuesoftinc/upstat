package utils

import (
	"context"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type contextKey string

const (
	userIDContextKey contextKey = "userId"
	emailContextKey  contextKey = "email"
)

func AuthenticateInterceptor(
	ctx context.Context,
	req any,
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (any, error) {
	switch info.FullMethod {
	case
		"/proto.UserService/CreateUser",
		"/proto.UserService/GetUser",
		"/proto.MonitorService/GetStatusPage",
		"/proto.MonitorService/GetRecentChecks",
				"/proto.UserService/GoogleAuth":
		return handler(ctx, req)
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing metadata")
	}

	authHeaders := md.Get("authorization")
	if len(authHeaders) == 0 {
		return nil, status.Error(codes.Unauthenticated, "missing authorization header")
	}

	authHeader := authHeaders[0]
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, status.Error(codes.Unauthenticated, "invalid authorization header")
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == "" {
		return nil, status.Error(codes.Unauthenticated, "missing token")
	}

	userID, email, err := ValidateToken(token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}
	if userID == "" || email == "" {
		return nil, status.Error(codes.Unauthenticated, "invalid token claims")
	}

	ctx = context.WithValue(ctx, userIDContextKey, userID)
	ctx = context.WithValue(ctx, emailContextKey, email)

	return handler(ctx, req)
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(userIDContextKey).(string)
	return userID, ok
}

func EmailFromContext(ctx context.Context) (string, bool) {
	email, ok := ctx.Value(emailContextKey).(string)
	return email, ok
}
