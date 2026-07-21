import { env } from "@/config/env";
import { UserServiceClient } from "@/proto/UserServiceClientPb";

// gRPC-Web endpoint (Envoy). NOTE: these generated stubs still target the
// stale /pb.UserService package — regeneration is tracked for the PRD phase.
export const userClient = new UserServiceClient(env.envoyUrl, null, null);
