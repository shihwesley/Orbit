# Orbit: Go test environment
# Fresh install for clean-room testing

ARG GO_VERSION=1.21
FROM golang:${GO_VERSION}-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git build-base

# Copy go.mod/sum first (layer caching)
COPY go.mod ./
COPY go.sum* ./

# Download dependencies
RUN go mod download

# Copy source
COPY . .

# Build to verify compilation
RUN go build -v ./...

# Default: run tests
CMD ["go", "test", "-v", "./..."]
