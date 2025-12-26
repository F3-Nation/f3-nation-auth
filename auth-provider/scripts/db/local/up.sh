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

# Wait for PostgreSQL to be ready (primary database)
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

# Wait for secondary database (f3prod_dev)
echo "Verifying f3prod_dev database..."
ATTEMPT=0
MAX_SECONDARY_ATTEMPTS=10
while ! docker compose exec -T postgres pg_isready -U f3prod -d f3prod_dev &> /dev/null; do
    ATTEMPT=$((ATTEMPT + 1))
    if [[ $ATTEMPT -ge $MAX_SECONDARY_ATTEMPTS ]]; then
        echo ""
        echo "Warning: f3prod_dev database may not be initialized yet"
        echo "If this is a fresh start, the init script should have run."
        echo "Run 'npm run db:local:reset' to reinitialize if needed."
        break
    fi
    sleep 1
done

echo ""
echo "Local PostgreSQL is ready!"
echo ""
echo "=== f3auth_dev (LOCAL_DATABASE_URL) ==="
echo "  Host:     localhost"
echo "  Port:     5433"
echo "  User:     f3auth"
echo "  Password: f3auth_local_dev"
echo "  Database: f3auth_dev"
echo "  URL:      postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev"
echo ""
echo "=== f3prod_dev (LOCAL_F3_DATABASE_URL) ==="
echo "  Host:     localhost"
echo "  Port:     5433"
echo "  User:     f3prod"
echo "  Password: f3prod_local_dev"
echo "  Database: f3prod_dev"
echo "  URL:      postgresql://f3prod:f3prod_local_dev@localhost:5433/f3prod_dev"
echo ""
echo "Use 'npm run db:local:seed' or 'npm run db:local:seed:all' to seed with snapshot data"
