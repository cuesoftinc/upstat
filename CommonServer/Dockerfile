# Use an official Golang runtime as a parent image
FROM golang:1.21.3-alpine

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed dependencies
RUN go mod download

# Build the Go app
RUN go build -o main .

# Expose port 8080 for the server to listen on
EXPOSE 8080

# Run the Go app when the container starts
CMD ["./main"]
