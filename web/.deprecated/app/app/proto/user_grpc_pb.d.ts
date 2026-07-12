// package: pb
// file: user.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as user_pb from "./user_pb";

interface IUserServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    getUser: IUserServiceService_IGetUser;
    createUser: IUserServiceService_ICreateUser;
    updateUser: IUserServiceService_IUpdateUser;
    deleteUser: IUserServiceService_IDeleteUser;
    getAllUsers: IUserServiceService_IGetAllUsers;
}

interface IUserServiceService_IGetUser extends grpc.MethodDefinition<user_pb.GetUserRequest, user_pb.GetUserResponse> {
    path: "/pb.UserService/GetUser";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<user_pb.GetUserRequest>;
    requestDeserialize: grpc.deserialize<user_pb.GetUserRequest>;
    responseSerialize: grpc.serialize<user_pb.GetUserResponse>;
    responseDeserialize: grpc.deserialize<user_pb.GetUserResponse>;
}
interface IUserServiceService_ICreateUser extends grpc.MethodDefinition<user_pb.CreateUserRequest, user_pb.CreateUserResponse> {
    path: "/pb.UserService/CreateUser";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<user_pb.CreateUserRequest>;
    requestDeserialize: grpc.deserialize<user_pb.CreateUserRequest>;
    responseSerialize: grpc.serialize<user_pb.CreateUserResponse>;
    responseDeserialize: grpc.deserialize<user_pb.CreateUserResponse>;
}
interface IUserServiceService_IUpdateUser extends grpc.MethodDefinition<user_pb.UpdateUserRequest, user_pb.UpdateUserResponse> {
    path: "/pb.UserService/UpdateUser";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<user_pb.UpdateUserRequest>;
    requestDeserialize: grpc.deserialize<user_pb.UpdateUserRequest>;
    responseSerialize: grpc.serialize<user_pb.UpdateUserResponse>;
    responseDeserialize: grpc.deserialize<user_pb.UpdateUserResponse>;
}
interface IUserServiceService_IDeleteUser extends grpc.MethodDefinition<user_pb.DeleteUserRequest, user_pb.DeleteUserResponse> {
    path: "/pb.UserService/DeleteUser";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<user_pb.DeleteUserRequest>;
    requestDeserialize: grpc.deserialize<user_pb.DeleteUserRequest>;
    responseSerialize: grpc.serialize<user_pb.DeleteUserResponse>;
    responseDeserialize: grpc.deserialize<user_pb.DeleteUserResponse>;
}
interface IUserServiceService_IGetAllUsers extends grpc.MethodDefinition<user_pb.Empty, user_pb.GetAllUsersResponse> {
    path: "/pb.UserService/GetAllUsers";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<user_pb.Empty>;
    requestDeserialize: grpc.deserialize<user_pb.Empty>;
    responseSerialize: grpc.serialize<user_pb.GetAllUsersResponse>;
    responseDeserialize: grpc.deserialize<user_pb.GetAllUsersResponse>;
}

export const UserServiceService: IUserServiceService;

export interface IUserServiceServer extends grpc.UntypedServiceImplementation {
    getUser: grpc.handleUnaryCall<user_pb.GetUserRequest, user_pb.GetUserResponse>;
    createUser: grpc.handleUnaryCall<user_pb.CreateUserRequest, user_pb.CreateUserResponse>;
    updateUser: grpc.handleUnaryCall<user_pb.UpdateUserRequest, user_pb.UpdateUserResponse>;
    deleteUser: grpc.handleUnaryCall<user_pb.DeleteUserRequest, user_pb.DeleteUserResponse>;
    getAllUsers: grpc.handleUnaryCall<user_pb.Empty, user_pb.GetAllUsersResponse>;
}

export interface IUserServiceClient {
    getUser(request: user_pb.GetUserRequest, callback: (error: grpc.ServiceError | null, response: user_pb.GetUserResponse) => void): grpc.ClientUnaryCall;
    getUser(request: user_pb.GetUserRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.GetUserResponse) => void): grpc.ClientUnaryCall;
    getUser(request: user_pb.GetUserRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.GetUserResponse) => void): grpc.ClientUnaryCall;
    createUser(request: user_pb.CreateUserRequest, callback: (error: grpc.ServiceError | null, response: user_pb.CreateUserResponse) => void): grpc.ClientUnaryCall;
    createUser(request: user_pb.CreateUserRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.CreateUserResponse) => void): grpc.ClientUnaryCall;
    createUser(request: user_pb.CreateUserRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.CreateUserResponse) => void): grpc.ClientUnaryCall;
    updateUser(request: user_pb.UpdateUserRequest, callback: (error: grpc.ServiceError | null, response: user_pb.UpdateUserResponse) => void): grpc.ClientUnaryCall;
    updateUser(request: user_pb.UpdateUserRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.UpdateUserResponse) => void): grpc.ClientUnaryCall;
    updateUser(request: user_pb.UpdateUserRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.UpdateUserResponse) => void): grpc.ClientUnaryCall;
    deleteUser(request: user_pb.DeleteUserRequest, callback: (error: grpc.ServiceError | null, response: user_pb.DeleteUserResponse) => void): grpc.ClientUnaryCall;
    deleteUser(request: user_pb.DeleteUserRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.DeleteUserResponse) => void): grpc.ClientUnaryCall;
    deleteUser(request: user_pb.DeleteUserRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.DeleteUserResponse) => void): grpc.ClientUnaryCall;
    getAllUsers(request: user_pb.Empty, callback: (error: grpc.ServiceError | null, response: user_pb.GetAllUsersResponse) => void): grpc.ClientUnaryCall;
    getAllUsers(request: user_pb.Empty, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.GetAllUsersResponse) => void): grpc.ClientUnaryCall;
    getAllUsers(request: user_pb.Empty, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.GetAllUsersResponse) => void): grpc.ClientUnaryCall;
}

export class UserServiceClient extends grpc.Client implements IUserServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public getUser(request: user_pb.GetUserRequest, callback: (error: grpc.ServiceError | null, response: user_pb.GetUserResponse) => void): grpc.ClientUnaryCall;
    public getUser(request: user_pb.GetUserRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.GetUserResponse) => void): grpc.ClientUnaryCall;
    public getUser(request: user_pb.GetUserRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.GetUserResponse) => void): grpc.ClientUnaryCall;
    public createUser(request: user_pb.CreateUserRequest, callback: (error: grpc.ServiceError | null, response: user_pb.CreateUserResponse) => void): grpc.ClientUnaryCall;
    public createUser(request: user_pb.CreateUserRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.CreateUserResponse) => void): grpc.ClientUnaryCall;
    public createUser(request: user_pb.CreateUserRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.CreateUserResponse) => void): grpc.ClientUnaryCall;
    public updateUser(request: user_pb.UpdateUserRequest, callback: (error: grpc.ServiceError | null, response: user_pb.UpdateUserResponse) => void): grpc.ClientUnaryCall;
    public updateUser(request: user_pb.UpdateUserRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.UpdateUserResponse) => void): grpc.ClientUnaryCall;
    public updateUser(request: user_pb.UpdateUserRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.UpdateUserResponse) => void): grpc.ClientUnaryCall;
    public deleteUser(request: user_pb.DeleteUserRequest, callback: (error: grpc.ServiceError | null, response: user_pb.DeleteUserResponse) => void): grpc.ClientUnaryCall;
    public deleteUser(request: user_pb.DeleteUserRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.DeleteUserResponse) => void): grpc.ClientUnaryCall;
    public deleteUser(request: user_pb.DeleteUserRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.DeleteUserResponse) => void): grpc.ClientUnaryCall;
    public getAllUsers(request: user_pb.Empty, callback: (error: grpc.ServiceError | null, response: user_pb.GetAllUsersResponse) => void): grpc.ClientUnaryCall;
    public getAllUsers(request: user_pb.Empty, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: user_pb.GetAllUsersResponse) => void): grpc.ClientUnaryCall;
    public getAllUsers(request: user_pb.Empty, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: user_pb.GetAllUsersResponse) => void): grpc.ClientUnaryCall;
}
