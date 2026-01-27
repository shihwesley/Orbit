# Orbit: Rust test environment
# Fresh install for clean-room testing

ARG RUST_VERSION=1.75
FROM rust:${RUST_VERSION}-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files first (layer caching)
COPY Cargo.toml ./
COPY Cargo.lock* ./

# Create dummy src to build deps
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src

# Copy real source
COPY . .

# Build
RUN cargo build --release

# Default: run tests
CMD ["cargo", "test", "--release"]
