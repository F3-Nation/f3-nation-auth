#!/bin/bash
set -euo pipefail

# Reset local PostgreSQL databases (cascade delete all data) using .env.local
# Usage: ./scripts/db/local/reset.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Check for psql
if ! command -v psql &> /dev/null; then
    echo "Error: psql not found"
    echo "Install PostgreSQL client tools:"
    echo "  macOS: brew install libpq && brew link --force libpq"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Load environment variables for local database URLs
load_env_var() {
    local var_name="$1"
    local env_file="$PROJECT_DIR/.env.local"
    if [[ -f "$env_file" ]]; then
        local value
        value=$(grep "^${var_name}=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2-)
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        echo "$value"
    fi
}

# Get database URL for a given database name from .env.local
get_db_url() {
    case "$1" in
        f3auth)
            local url="${DATABASE_URL:-}"
            [[ -z "$url" ]] && url=$(load_env_var "DATABASE_URL")
            [[ -z "$url" ]] && url="postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev"
            echo "$url"
            ;;
        f3prod)
            local url="${F3_DATABASE_URL:-}"
            [[ -z "$url" ]] && url=$(load_env_var "F3_DATABASE_URL")
            [[ -z "$url" ]] && url="postgresql://f3prod:f3prod_local_dev@localhost:5433/f3prod_dev"
            echo "$url"
            ;;
    esac
}

# Function to reset a single database
reset_db() {
    local db_name="$1"
    local db_url
    db_url=$(get_db_url "$db_name")

    # Check if local PostgreSQL is running
    if ! psql "$db_url" -c "SELECT 1" &> /dev/null; then
        echo "Error: Cannot connect to local $db_name database"
        echo "Run 'npm run db:local:up' first"
        return 1
    fi

    echo "Resetting $db_name database..."

    # Drop and recreate public schema
    local setup_sql="DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS citext;"

    # For f3prod, also create required types and functions
    if [[ "$db_name" == "f3prod" ]]; then
        setup_sql="$setup_sql CREATE TYPE public.user_status AS ENUM ('active', 'inactive');"
        setup_sql="$setup_sql CREATE OR REPLACE FUNCTION public.set_updated_column() RETURNS TRIGGER AS \$\$ BEGIN NEW.updated = timezone('utc', now()); RETURN NEW; END; \$\$ LANGUAGE plpgsql;"
    fi

    psql "$db_url" -c "$setup_sql" > /dev/null

    echo "  $db_name reset complete (all tables dropped)"
}

# Reset both databases
RESET_FAILED=false

echo "Resetting all local databases..."
echo ""

if ! reset_db "f3auth"; then
    RESET_FAILED=true
fi

echo ""

if ! reset_db "f3prod"; then
    RESET_FAILED=true
fi

echo ""
if [[ "$RESET_FAILED" == "true" ]]; then
    echo "Some databases failed to reset. Check the output above."
    exit 1
fi

echo "Local databases reset. Run 'npm run db:local:seed' to restore data from snapshots."
