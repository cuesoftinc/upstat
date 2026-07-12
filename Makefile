# Dynamic path variables to guarantee cross-environment stability
ROOT_DIR := $(shell pwd)
API_DIR  := $(ROOT_DIR)/api/common
OBS_DIR  := $(ROOT_DIR)/api/observability
WEB_DIR  := $(ROOT_DIR)/web

# Define default automation target when typing just 'make'
.DEFAULT_GOAL := help

# Declare all non-file targets as .PHONY to prevent folder name execution conflicts
.PHONY: help setup api obs web test clean

## help: Print out all available automation targets and descriptions
help:
	@echo "Upstat Monorepo Management Console"
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available Tasks:"
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | column -t -s ':' | sed -e 's/^/  /'

## setup: Install dependencies for every service (Go, Python, web)
setup:
	@echo "Installing dependencies for all services..."
	cd $(API_DIR) && go mod download
	cd $(OBS_DIR) && pip install -r requirements.txt
	cd $(WEB_DIR) && npm install

## api: Run the Go backend (api/common)
api:
	@echo "Starting Go backend..."
	cd $(API_DIR) && go run .

## obs: Run the Python observability service (api/observability)
obs:
	@echo "Starting observability service..."
	cd $(OBS_DIR) && uvicorn main:app --reload

## web: Run the Next.js web app (web)
web:
	@echo "Starting web app..."
	cd $(WEB_DIR) && npm run dev

## test: Run the Go backend test suite
test:
	@echo "Running tests..."
	cd $(API_DIR) && go test ./...

## clean: Remove local build artifacts and caches
clean:
	@echo "Purging build artifacts..."
	cd $(API_DIR) && go clean && rm -f upstat
