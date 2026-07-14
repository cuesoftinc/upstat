# Regenerate Go protobuf/gRPC stubs (requires protoc + protoc-gen-go{,-grpc}).
generate_grpc_code:
	PATH="$$PATH:$$(go env GOPATH)/bin" protoc --go_out=. --go_opt=paths=source_relative \
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \
		internal/proto/user.proto internal/proto/insight.proto
