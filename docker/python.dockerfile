# Orbit: Python test environment
# Fresh install for clean-room testing

ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first (layer caching)
COPY requirements*.txt ./
COPY pyproject.toml* ./
COPY setup.py* ./
COPY setup.cfg* ./

# Install dependencies
RUN if [ -f requirements.txt ]; then \
        pip install --no-cache-dir -r requirements.txt; \
    fi && \
    if [ -f requirements-dev.txt ]; then \
        pip install --no-cache-dir -r requirements-dev.txt; \
    fi && \
    if [ -f pyproject.toml ]; then \
        pip install --no-cache-dir -e .[dev] 2>/dev/null || pip install --no-cache-dir -e . 2>/dev/null || true; \
    fi

# Copy source
COPY . .

# Default: run tests
CMD ["pytest", "-v"]
