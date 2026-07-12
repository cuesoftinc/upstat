// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var user_pb = require('./user_pb.js');

function serialize_pb_CreateUserRequest(arg) {
  if (!(arg instanceof user_pb.CreateUserRequest)) {
    throw new Error('Expected argument of type pb.CreateUserRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_CreateUserRequest(buffer_arg) {
  return user_pb.CreateUserRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_CreateUserResponse(arg) {
  if (!(arg instanceof user_pb.CreateUserResponse)) {
    throw new Error('Expected argument of type pb.CreateUserResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_CreateUserResponse(buffer_arg) {
  return user_pb.CreateUserResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_DeleteUserRequest(arg) {
  if (!(arg instanceof user_pb.DeleteUserRequest)) {
    throw new Error('Expected argument of type pb.DeleteUserRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_DeleteUserRequest(buffer_arg) {
  return user_pb.DeleteUserRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_DeleteUserResponse(arg) {
  if (!(arg instanceof user_pb.DeleteUserResponse)) {
    throw new Error('Expected argument of type pb.DeleteUserResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_DeleteUserResponse(buffer_arg) {
  return user_pb.DeleteUserResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_Empty(arg) {
  if (!(arg instanceof user_pb.Empty)) {
    throw new Error('Expected argument of type pb.Empty');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_Empty(buffer_arg) {
  return user_pb.Empty.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_GetAllUsersResponse(arg) {
  if (!(arg instanceof user_pb.GetAllUsersResponse)) {
    throw new Error('Expected argument of type pb.GetAllUsersResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_GetAllUsersResponse(buffer_arg) {
  return user_pb.GetAllUsersResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_GetUserRequest(arg) {
  if (!(arg instanceof user_pb.GetUserRequest)) {
    throw new Error('Expected argument of type pb.GetUserRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_GetUserRequest(buffer_arg) {
  return user_pb.GetUserRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_GetUserResponse(arg) {
  if (!(arg instanceof user_pb.GetUserResponse)) {
    throw new Error('Expected argument of type pb.GetUserResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_GetUserResponse(buffer_arg) {
  return user_pb.GetUserResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_UpdateUserRequest(arg) {
  if (!(arg instanceof user_pb.UpdateUserRequest)) {
    throw new Error('Expected argument of type pb.UpdateUserRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_UpdateUserRequest(buffer_arg) {
  return user_pb.UpdateUserRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_pb_UpdateUserResponse(arg) {
  if (!(arg instanceof user_pb.UpdateUserResponse)) {
    throw new Error('Expected argument of type pb.UpdateUserResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_pb_UpdateUserResponse(buffer_arg) {
  return user_pb.UpdateUserResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var UserServiceService = exports.UserServiceService = {
  getUser: {
    path: '/pb.UserService/GetUser',
    requestStream: false,
    responseStream: false,
    requestType: user_pb.GetUserRequest,
    responseType: user_pb.GetUserResponse,
    requestSerialize: serialize_pb_GetUserRequest,
    requestDeserialize: deserialize_pb_GetUserRequest,
    responseSerialize: serialize_pb_GetUserResponse,
    responseDeserialize: deserialize_pb_GetUserResponse,
  },
  createUser: {
    path: '/pb.UserService/CreateUser',
    requestStream: false,
    responseStream: false,
    requestType: user_pb.CreateUserRequest,
    responseType: user_pb.CreateUserResponse,
    requestSerialize: serialize_pb_CreateUserRequest,
    requestDeserialize: deserialize_pb_CreateUserRequest,
    responseSerialize: serialize_pb_CreateUserResponse,
    responseDeserialize: deserialize_pb_CreateUserResponse,
  },
  updateUser: {
    path: '/pb.UserService/UpdateUser',
    requestStream: false,
    responseStream: false,
    requestType: user_pb.UpdateUserRequest,
    responseType: user_pb.UpdateUserResponse,
    requestSerialize: serialize_pb_UpdateUserRequest,
    requestDeserialize: deserialize_pb_UpdateUserRequest,
    responseSerialize: serialize_pb_UpdateUserResponse,
    responseDeserialize: deserialize_pb_UpdateUserResponse,
  },
  deleteUser: {
    path: '/pb.UserService/DeleteUser',
    requestStream: false,
    responseStream: false,
    requestType: user_pb.DeleteUserRequest,
    responseType: user_pb.DeleteUserResponse,
    requestSerialize: serialize_pb_DeleteUserRequest,
    requestDeserialize: deserialize_pb_DeleteUserRequest,
    responseSerialize: serialize_pb_DeleteUserResponse,
    responseDeserialize: deserialize_pb_DeleteUserResponse,
  },
  getAllUsers: {
    path: '/pb.UserService/GetAllUsers',
    requestStream: false,
    responseStream: false,
    requestType: user_pb.Empty,
    responseType: user_pb.GetAllUsersResponse,
    requestSerialize: serialize_pb_Empty,
    requestDeserialize: deserialize_pb_Empty,
    responseSerialize: serialize_pb_GetAllUsersResponse,
    responseDeserialize: deserialize_pb_GetAllUsersResponse,
  },
};

exports.UserServiceClient = grpc.makeGenericClientConstructor(UserServiceService);
