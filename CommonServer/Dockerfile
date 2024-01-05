
# Use a specific Golang version as a base image
FROM golang:1.21.3-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy the go.mod and go.sum files to the workspace
COPY go.mod go.sum ./

# Download and install dependencies
RUN go mod download

# Copy the entire project into the container
COPY . .

# Build the Go application
RUN go build -o myapp

# Start a new stage from scratch
FROM alpine:latest

# Set the working directory inside the container
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=builder /app/myapp .

# Copy the .env file
COPY .env .

# Expose the port on which the application will run
ENV PORT=8080
EXPOSE $PORT

# Command to run the executable
CMD ["./myapp"]