# Upstat Common Server gRPC API

This document describes the gRPC API exposed by the Go backend in `api/common`.

## Server

Local development address:

```text
localhost:8080
```

Proto source of truth:

```text
api/common/proto/user.proto
```

Frontend/client proto copy:

```text
App/proto/user.proto
```

The server enables gRPC reflection, so clients (Insomnia, grpcurl, etc.) can
discover services without importing the proto file.

When the backend proto changes, regenerate the Go server bindings from `api/common`:

```bash
cd api/common
make generate_grpc_code
```

## Environment

The backend requires:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=Upstat
JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id.apps.googleusercontent.com
BASE_URL=http://localhost:8080/
SMTP_USERNAME=
SMTP_PASSWORD=
```

`GOOGLE_CLIENT_ID` must match the Google OAuth client used by the frontend to obtain the Google ID token.

## Services

```proto
service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc GoogleAuth(GoogleAuthRequest) returns (GetUserResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
  rpc GetAllUsers(Empty) returns (GetAllUsersResponse);
}

service MonitorService {
  rpc CreateMonitor(CreateMonitorRequest) returns (MonitorResponse);
  rpc UpdateMonitor(UpdateMonitorRequest) returns (MonitorResponse);
  rpc GetMonitor(GetMonitorRequest) returns (MonitorResponse);
  rpc ListMonitors(ListMonitorsRequest) returns (ListMonitorsResponse);
  rpc DeleteMonitor(DeleteMonitorRequest) returns (DeleteMonitorResponse);
  rpc GetStatusPage(GetStatusPageRequest) returns (GetStatusPageResponse);
}
```

## Auth Model

The backend issues its own app JWT after successful password login or Google auth.

A unary interceptor enforces authentication on every RPC except the public ones
listed below. Authenticated RPCs must send the app JWT as gRPC metadata:

```text
authorization: Bearer <app.jwt.token>
```

Requests missing or carrying an invalid token are rejected with `Unauthenticated`.

Public RPCs (no token required):

```text
proto.UserService/CreateUser
proto.UserService/GetUser
proto.UserService/GoogleAuth
proto.MonitorService/GetStatusPage
```

For `MonitorService` RPCs the authenticated user id is taken from the token and
used as the monitor owner, so the owner is never sent in the request body
(except `GetStatusPage`, which is public and takes an explicit `owner_id`).

Common auth errors:

```text
Unauthenticated: missing authorization header
Unauthenticated: invalid authorization header
Unauthenticated: missing token
Unauthenticated: invalid token
Unauthenticated: invalid token claims
```

## Google Auth

Use this when the frontend signs a user in with Google.

The frontend must send the Google **ID token**, not the Google access token.

Method:

```text
proto.UserService/GoogleAuth
```

Request:

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

Success response:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "token": "app.jwt.token",
  "status": "success"
}
```

Behavior:

- Verifies the Google ID token signature.
- Verifies the token issuer is Google.
- Verifies the token audience equals `GOOGLE_CLIENT_ID`.
- Requires Google email verification.
- Finds the local user by email.
- Creates a local user if one does not already exist.
- Returns the app JWT in `token`.

Common errors:

```text
Unauthenticated: GOOGLE_CLIENT_ID is not configured
Unauthenticated: invalid google token audience
Unauthenticated: google account email is not verified
Unauthenticated: invalid google id token
```

## Create User

Use this for email/password signup.

Method:

```text
proto.UserService/CreateUser
```

Request:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "password123"
}
```

Success response:

```json
{
  "data": "user created successfully",
  "status": "success"
}
```

Common errors:

```text
InvalidArgument: name, email, and password are required
AlreadyExists: email already exists
Internal: could not create user
```

## Get User

Use this for email/password login when `password` is provided.

Method:

```text
proto.UserService/GetUser
```

Request:

```json
{
  "email": "ada@example.com",
  "password": "password123"
}
```

Success response:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "token": "app.jwt.token",
  "status": "success"
}
```

Common errors:

```text
NotFound: user not found
Unauthenticated: invalid login credentials
```

## Get All Users

Requires `authorization: Bearer <token>` metadata.

Method:

```text
proto.UserService/GetAllUsers
```

Request:

```json
{}
```

Success response:

```json
{
  "users": [
    {
      "id": "665f0e3fdc43b6a01e985f9a",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "status": "success"
    }
  ]
}
```

## Update User

Requires `authorization: Bearer <token>` metadata.

Method:

```text
proto.UserService/UpdateUser
```

Request:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a",
  "name": "Ada Byron",
  "email": "ada@example.com",
  "password": "new-password123"
}
```

Success response:

```json
{
  "data": "user updated successfully",
  "status": "success"
}
```

Notes:

- `id` is required.
- `name`, `email`, and `password` are optional update fields.
- If `password` is provided, the backend hashes it before storing.

## Delete User

Requires `authorization: Bearer <token>` metadata.

Method:

```text
proto.UserService/DeleteUser
```

Request:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a"
}
```

Success response:

```json
{
  "data": "user deleted successfully",
  "status": "success"
}
```

## Create Monitor

Requires `authorization: Bearer <token>` metadata. The monitor owner is taken
from the token.

Method:

```text
proto.MonitorService/CreateMonitor
```

Request:

```json
{
  "name": "Marketing site",
  "type": "http",
  "target": "https://example.com"
}
```

Success response:

```json
{
  "monitor": {
    "id": "665f0e3fdc43b6a01e985f9a",
    "owner_id": "665f0e3fdc43b6a01e985f9b",
    "name": "Marketing site",
    "type": "http",
    "target": "https://example.com",
    "created_at": "2024-06-04T12:00:00Z",
    "updated_at": "2024-06-04T12:00:00Z",
    "active": true,
    "status": "unknown",
    "interval_seconds": 60,
    "timeout_seconds": 10,
    "failure_threshold": 3,
    "consecutive_failures": 0,
    "last_checked_at": "",
    "last_response_time_ms": 0,
    "last_status_code": 0
  },
  "status": "success"
}
```

Notes:

- `name`, `type`, and `target` are required.
- New monitors default to `active: true`, `status: "unknown"`,
  `interval_seconds: 60`, `timeout_seconds: 10`, and `failure_threshold: 3`.

Common errors:

```text
Unauthenticated: missing authentiacated user
InvalidArgument: name, type and target required
Internal: internal server error, could not create monitor
```

## Get Monitor

Requires `authorization: Bearer <token>` metadata. Returns a monitor owned by
the authenticated user.

Method:

```text
proto.MonitorService/GetMonitor
```

Request:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a"
}
```

Success response: same `MonitorResponse` shape as Create Monitor.

Common errors:

```text
Unauthenticated: User is not authenticated
InvalidArgument: please pass a monitor id
```

## Update Monitor

Requires `authorization: Bearer <token>` metadata.

Method:

```text
proto.MonitorService/UpdateMonitor
```

Request:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a",
  "name": "Marketing site (prod)",
  "type": "http",
  "target": "https://example.com"
}
```

Success response: same `MonitorResponse` shape as Create Monitor.

Notes:

- `id`, `name`, `type`, and `target` are all required.

Common errors:

```text
Unauthenticated: user is not authenticated
InvalidArgument: id, name, type and target required
NotFound: monitor not found
```

## List Monitors

Requires `authorization: Bearer <token>` metadata. Returns the monitors owned by
the authenticated user.

Method:

```text
proto.MonitorService/ListMonitors
```

Request:

```json
{}
```

Success response:

```json
{
  "monitors": [
    {
      "id": "665f0e3fdc43b6a01e985f9a",
      "owner_id": "665f0e3fdc43b6a01e985f9b",
      "name": "Marketing site",
      "type": "http",
      "target": "https://example.com",
      "active": true,
      "status": "unknown",
      "interval_seconds": 60,
      "timeout_seconds": 10,
      "failure_threshold": 3,
      "consecutive_failures": 0,
      "last_checked_at": "",
      "last_response_time_ms": 0,
      "last_status_code": 0
    }
  ]
}
```

## Delete Monitor

Requires `authorization: Bearer <token>` metadata.

Method:

```text
proto.MonitorService/DeleteMonitor
```

Request:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a"
}
```

Success response:

```json
{
  "data": "Monitor Deleted",
  "status": "success"
}
```

Common errors:

```text
Unauthenticated: user is not authenticated
InvalidArgument: monitor ID is required
NotFound: monitor was not found; nothing was deleted
```

## Get Status Page

Public RPC (no token required). Returns the public status page for a given owner,
including monitors, incidents, and recent uptime statistics (last 24 hours).

Method:

```text
proto.MonitorService/GetStatusPage
```

Request:

```json
{
  "owner_id": "665f0e3fdc43b6a01e985f9b"
}
```

Success response:

```json
{
  "monitors": [
    {
      "id": "665f0e3fdc43b6a01e985f9a",
      "owner_id": "665f0e3fdc43b6a01e985f9b",
      "name": "Marketing site",
      "type": "http",
      "target": "https://example.com",
      "active": true,
      "status": "up"
    }
  ],
  "active_incidents": [],
  "historical_incidents": [
    {
      "id": "665f0e3fdc43b6a01e985f9c",
      "monitor_id": "665f0e3fdc43b6a01e985f9a",
      "title": "HTTP 500 on https://example.com",
      "failure_reason": "unexpected status code 500",
      "status": "resolved",
      "started_at": "2024-06-04T10:00:00Z",
      "resolved_at": "2024-06-04T10:05:00Z",
      "duration_seconds": 300
    }
  ],
  "uptime_percentage": 99.5,
  "total_checks": 1440,
  "successful_checks": 1433
}
```

Notes:

- `uptime_percentage`, `total_checks`, and `successful_checks` are computed from
  check results recorded in the last 24 hours.
- Historical (resolved) incidents are limited to the 50 most recent.

Common errors:

```text
InvalidArgument: owner_id is required
Internal: could not list monitors
Internal: could not list active incidents
Internal: could not list historical incidents
Internal: could not calculate uptime statistics
```

## Testing With Insomnia

1. Start the backend:

```bash
cd api/common
go run main.go
```

2. Create a gRPC request in Insomnia.

3. Use server address:

```text
localhost:8080
```

4. Import or reference (or rely on server reflection):

```text
api/common/proto/user.proto
```

5. Select a service:

```text
proto.UserService
proto.MonitorService
```

6. Choose the RPC method and send the JSON request body. For authenticated RPCs,
   add an `authorization` metadata header with value `Bearer <token>` using a
   token returned by `GetUser` or `GoogleAuth`.
```