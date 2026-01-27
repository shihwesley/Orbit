# Orbit: Node.js test environment
# Fresh install for clean-room testing

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files first (layer caching)
COPY package*.json ./
COPY pnpm-lock.yaml* ./
COPY yarn.lock* ./

# Detect package manager and install
RUN if [ -f pnpm-lock.yaml ]; then \
        corepack enable && pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then \
        yarn install --frozen-lockfile; \
    else \
        npm ci; \
    fi

# Copy source
COPY . .

# Build if script exists
RUN npm run build --if-present 2>/dev/null || true

# Default: run tests
CMD ["npm", "test"]
