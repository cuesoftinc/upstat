import * as grpcWeb from "grpc-web";
import { GoogleAuthRequest, GetUserResponse } from "./user_pb";

export class UserServiceClient {
  private client: grpcWeb.GrpcWebClientBase;
  private hostname: string;

  constructor(hostname: string) {
    this.hostname = hostname.replace(/\/+$/, "");
    this.client = new grpcWeb.GrpcWebClientBase({ format: "text" });
  }

  private methodDescriptorGoogleAuth = new grpcWeb.MethodDescriptor<GoogleAuthRequest, GetUserResponse>(
    "/proto.UserService/GoogleAuth",
    grpcWeb.MethodType.UNARY,
    GoogleAuthRequest,
    GetUserResponse,
    (request: GoogleAuthRequest) => request.serializeBinary(),
    GetUserResponse.deserializeBinary
  );

  googleAuth(
    request: GoogleAuthRequest,
    metadata: grpcWeb.Metadata | null = {}
  ): Promise<GetUserResponse> {
    return new Promise((resolve, reject) => {
      this.client.rpcCall(
        this.hostname + "/proto.UserService/GoogleAuth",
        request,
        metadata || {},
        this.methodDescriptorGoogleAuth,
        (err: grpcWeb.RpcError, response: GetUserResponse) => {
          if (err) {
            reject(err);
          } else {
            resolve(response);
          }
        }
      );
    });
  }
}