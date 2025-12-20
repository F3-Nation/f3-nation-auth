#!/bin/bash
set -euo pipefail

# Start local PostgreSQL container
# Usage: ./scripts/db/local/up.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Check Docker is running
if ! docker info &> /dev/null; then
    echo "Error: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "Starting local PostgreSQL..."

# Start container
cd "$PROJECT_DIR"
docker compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
while ! docker compose exec -T postgres pg_isready -U f3auth -d f3auth_dev &> /dev/null; do
    ATTEMPT=$((ATTEMPT + 1))
    if [[ $ATTEMPT -ge $MAX_ATTEMPTS ]]; then
        echo "Error: PostgreSQL failed to start after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    sleep 1
done

echo ""
echo "Local PostgreSQL is ready!"
echo ""
echo "Connection details:"
echo "  Host:     localhost"
echo "  Port:     5433"
echo "  User:     f3auth"
echo "  Password: f3auth_local_dev"
echo "  Database: f3auth_dev"
echo ""
echo "Connection string:"
echo "  postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev"
echo ""
echo "Use 'npm run db:local:seed' to seed with snapshot data"
