package util

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type contextKey string

const (
	userIDContextKey contextKey = "userId"
	emailContextKey  contextKey = "email"
	nameContextKey   contextKey = "name"
)

func AuthenticateInterceptor(
	ctx context.Context,
	req any,
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (any, error) {
	switch info.FullMethod {
	case
		"/proto.UserService/GetUser",
		"/proto.MonitorService/GetStatusPage",
		"/proto.MonitorService/GetRecentChecks":
		return handler(ctx, req)
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing metadata")
	}

	claims, ok := authenticateHeaders(
		first(md, "authorization"),
		first(md, "cookie"),
		first(md, "origin"),
		first(md, "sec-fetch-site"),
	)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "invalid or missing credentials")
	}

	ctx = context.WithValue(ctx, userIDContextKey, claims.UserID)
	ctx = context.WithValue(ctx, emailContextKey, claims.Email)
	ctx = context.WithValue(ctx, nameContextKey, claims.Name)

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

func first(md metadata.MD, key string) string {
	if v := md.Get(key); len(v) > 0 {
		return v[0]
	}
	return ""
}
