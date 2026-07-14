import { UserServiceClient } from "./proto/UserServiceClientPb";

// gRPC-Web endpoint (Envoy). NOTE: these generated stubs still target the
// stale /pb.UserService package — regeneration is tracked for the PRD phase.
const ENVOY_URL = process.env.NEXT_PUBLIC_ENVOY_URL || "http://localhost:8082";

export const userClient = new UserServiceClient(ENVOY_URL, null, null);
