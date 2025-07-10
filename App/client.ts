import { UserServiceClient } from "./proto/UserServiceClientPb";

export const userClient = new UserServiceClient("localhost:8080", null, null)


console.log(userClient)