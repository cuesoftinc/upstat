package service

import (
	"context"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	pb "github.com/cuesoftinc/upstat/api/common/internal/proto"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type UserServiceServer struct {
	pb.UnimplementedUserServiceServer
	userRepo repository.UserRepository
}

func NewUserServiceServer(db *config.DB) *UserServiceServer {
	return &UserServiceServer{
		userRepo: repository.NewUserRepository(db),
	}
}

func (s *UserServiceServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserResponse, error) {
	// The unauthenticated allowlist admits this RPC for the login path only.
	// Without a password this would be an anonymous user-lookup by email
	// (PII disclosure/enumeration), so refuse it.
	if req.GetPassword() == "" {
		return nil, status.Error(codes.PermissionDenied, "authentication required")
	}
	user, err := s.userRepo.GetUser(req.GetEmail())
	if err != nil {
		return nil, status.Error(codes.NotFound, "user not found")
	}

	if req.GetPassword() != "" && !util.ComparePassword(user.Password, req.GetPassword()) {
		return nil, status.Error(codes.Unauthenticated, "invalid login credentials")
	}

	token := ""
	if req.GetPassword() != "" {
		var err error
		token, err = util.GenerateToken(user.Id.Hex(), user.Email)
		if err != nil {
			return nil, status.Error(codes.Internal, "failed to issue session token")
		}
	}

	return userResponse(user, token, "success"), nil
}

func (s *UserServiceServer) GoogleAuth(ctx context.Context, req *pb.GoogleAuthRequest) (*pb.GetUserResponse, error) {
	googleUser, err := util.VerifyGoogleIDToken(req.GetIdToken())
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, err.Error())
	}

	user, err := s.userRepo.GetUser(googleUser.Email)
	if err != nil {
		name := googleUser.Name
		if name == "" {
			name = googleUser.Email
		}

		if _, err := s.userRepo.CreateUser(model.User{
			Name:  name,
			Email: googleUser.Email,
		}); err != nil {
			return nil, status.Error(codes.Internal, "could not create google user")
		}

		user, err = s.userRepo.GetUser(googleUser.Email)
		if err != nil {
			return nil, status.Error(codes.Internal, "could not retrieve google user")
		}
	}

	token, err := util.GenerateToken(user.Id.Hex(), user.Email)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to issue session token")
	}
	return userResponse(user, token, "success"), nil
}

func (s *UserServiceServer) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.CreateUserResponse, error) {
	if req.GetName() == "" || req.GetEmail() == "" || req.GetPassword() == "" {
		return nil, status.Error(codes.InvalidArgument, "name, email, and password are required")
	}

	if _, err := s.userRepo.GetUser(req.GetEmail()); err == nil {
		return nil, status.Error(codes.AlreadyExists, "email already exists")
	}

	password := req.GetPassword()
	if _, err := util.HashPassword(&password); err != nil {
		return nil, status.Error(codes.Internal, "could not hash password")
	}

	_, err := s.userRepo.CreateUser(model.User{
		Name:     req.GetName(),
		Email:    req.GetEmail(),
		Password: password,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "could not create user")
	}

	return &pb.CreateUserResponse{
		Data:   "user created successfully",
		Status: "success",
	}, nil
}

func (s *UserServiceServer) UpdateUser(ctx context.Context, req *pb.UpdateUserRequest) (*pb.UpdateUserResponse, error) {
	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	password := req.GetPassword()
	if password != "" {
		if _, err := util.HashPassword(&password); err != nil {
			return nil, status.Error(codes.Internal, "could not hash password")
		}
	}

	_, err := s.userRepo.UpdateUser(req.GetId(), model.User{
		Name:     req.GetName(),
		Email:    req.GetEmail(),
		Password: password,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "could not update user")
	}

	return &pb.UpdateUserResponse{
		Data:   "user updated successfully",
		Status: "success",
	}, nil
}

func (s *UserServiceServer) DeleteUser(ctx context.Context, req *pb.DeleteUserRequest) (*pb.DeleteUserResponse, error) {
	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	_, err := s.userRepo.DeleteUser(req.GetId())
	if err != nil {
		return nil, status.Error(codes.Internal, "could not delete user")
	}

	return &pb.DeleteUserResponse{
		Data:   "user deleted successfully",
		Status: "success",
	}, nil
}

func (s *UserServiceServer) GetAllUsers(ctx context.Context, req *pb.Empty) (*pb.GetAllUsersResponse, error) {
	users, err := s.userRepo.GetUsers()
	if err != nil {
		return nil, status.Error(codes.Internal, "could not retrieve users")
	}

	response := &pb.GetAllUsersResponse{
		Users: make([]*pb.GetUserResponse, 0, len(users)),
	}
	for _, user := range users {
		response.Users = append(response.Users, userResponse(user, "", "success"))
	}

	return response, nil
}

func userResponse(user *model.User, token string, responseStatus string) *pb.GetUserResponse {
	return &pb.GetUserResponse{
		Id:     user.Id.Hex(),
		Name:   user.Name,
		Email:  user.Email,
		Token:  token,
		Status: responseStatus,
	}
}
