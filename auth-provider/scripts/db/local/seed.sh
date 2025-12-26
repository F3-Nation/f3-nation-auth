#!/bin/bash
set -euo pipefail

# Seed local PostgreSQL from snapshot
# Usage: ./scripts/db/local/seed.sh [--db f3auth|f3prod|all] [snapshot-path]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
SNAPSHOTS_DIR="$PROJECT_DIR/db-snapshots"

# Parse arguments
DB_TARGET="f3auth"
SNAPSHOT_PATH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --db)
            DB_TARGET="$2"
            shift 2
            ;;
        *)
            SNAPSHOT_PATH="$1"
            shift
            ;;
    esac
done

if [[ ! "$DB_TARGET" =~ ^(f3auth|f3prod|all)$ ]]; then
    echo "Error: Invalid --db value '$DB_TARGET'. Must be: f3auth, f3prod, or all"
    exit 1
fi

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
        # Remove surrounding quotes if present
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        echo "$value"
    fi
}

# Get local database URL for a given database name
get_db_url() {
    case "$1" in
        f3auth)
            local url="${LOCAL_DATABASE_URL:-}"
            [[ -z "$url" ]] && url=$(load_env_var "LOCAL_DATABASE_URL")
            [[ -z "$url" ]] && url="postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev"
            echo "$url"
            ;;
        f3prod)
            local url="${LOCAL_F3_DATABASE_URL:-}"
            [[ -z "$url" ]] && url=$(load_env_var "LOCAL_F3_DATABASE_URL")
            [[ -z "$url" ]] && url="postgresql://f3prod:f3prod_local_dev@localhost:5433/f3prod_dev"
            echo "$url"
            ;;
    esac
}

# Get environment variable name for a given database name
get_env_var() {
    case "$1" in
        f3auth) echo "LOCAL_DATABASE_URL" ;;
        f3prod) echo "LOCAL_F3_DATABASE_URL" ;;
    esac
}

# Function to seed a single database
seed_db() {
    local db_name="$1"
    local custom_snapshot_path="$2"
    local db_url
    local env_var
    db_url=$(get_db_url "$db_name")
    env_var=$(get_env_var "$db_name")

    # Determine snapshot path
    local snapshot_path="$custom_snapshot_path"
    if [[ -z "$snapshot_path" ]]; then
        snapshot_path="$SNAPSHOTS_DIR/$db_name/latest"
    fi

    # Resolve symlink if needed
    if [[ -L "$snapshot_path" ]]; then
        snapshot_path="$SNAPSHOTS_DIR/$db_name/$(readlink "$snapshot_path")"
    fi

    if [[ ! -d "$snapshot_path" ]]; then
        echo "Warning: No snapshot found for $db_name at $snapshot_path"
        echo "Run 'npm run db:snapshot --db $db_name' first to create a snapshot"
        return 1
    fi

    # Check if local PostgreSQL is running
    if ! psql "$db_url" -c "SELECT 1" &> /dev/null; then
        echo "Error: Cannot connect to local $db_name database"
        echo "Run 'npm run db:local:up' first"
        return 1
    fi

    echo "Seeding $db_name database from snapshot..."
    echo "  Snapshot: $snapshot_path"

    # Check what files exist
    local has_schema=false
    local has_data=false
    [[ -f "$snapshot_path/schema.sql" ]] && has_schema=true
    [[ -f "$snapshot_path/data.sql" ]] && has_data=true

    if [[ "$has_schema" == "false" && "$has_data" == "false" ]]; then
        echo "Error: No schema.sql or data.sql found in snapshot"
        return 1
    fi

    # Drop and recreate public schema to clear all tables
    echo "  Clearing existing data..."
    local setup_sql="DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS citext;"

    # For f3prod, also create required types and functions
    if [[ "$db_name" == "f3prod" ]]; then
        setup_sql="$setup_sql CREATE TYPE public.user_status AS ENUM ('active', 'inactive');"
        setup_sql="$setup_sql CREATE OR REPLACE FUNCTION public.set_updated_column() RETURNS TRIGGER AS \$\$ BEGIN NEW.updated = timezone('utc', now()); RETURN NEW; END; \$\$ LANGUAGE plpgsql;"
    fi

    psql "$db_url" -c "$setup_sql" > /dev/null

    # Restore schema
    if [[ "$has_schema" == "true" ]]; then
        echo "  Restoring schema..."
        psql "$db_url" -f "$snapshot_path/schema.sql" > /dev/null 2>&1 || true
    fi

    # Restore data
    if [[ -d "$snapshot_path/csv" ]]; then
        # CSV format: load each CSV file
        echo "  Restoring data from CSV files..."
        for csv_file in "$snapshot_path/csv"/*.csv; do
            if [[ -f "$csv_file" ]]; then
                # Extract table name from filename (public_tablename.csv -> public.tablename)
                local filename=$(basename "$csv_file" .csv)
                local table_name="${filename/_/.}"
                local row_count=$(( $(wc -l < "$csv_file" | tr -d ' ') - 1 ))
                if [[ $row_count -gt 0 ]]; then
                    echo "    Loading $table_name ($row_count rows)..."
                    psql "$db_url" -c "\\COPY $table_name FROM '$csv_file' WITH (FORMAT CSV, HEADER)" > /dev/null 2>&1 || {
                        echo "    Warning: Failed to load $table_name"
                    }
                fi
            fi
        done
    elif [[ "$has_data" == "true" ]]; then
        echo "  Restoring data..."
        psql "$db_url" -f "$snapshot_path/data.sql" > /dev/null 2>&1 || true
    fi

    echo ""
    echo "$db_name database seeded successfully!"
    echo "  $env_var=$db_url"
}

# Execute based on target
SEED_FAILED=false

if [[ "$DB_TARGET" == "all" ]]; then
    echo "Seeding all databases..."
    echo ""

    if ! seed_db "f3auth" ""; then
        SEED_FAILED=true
    fi

    echo ""

    if ! seed_db "f3prod" ""; then
        SEED_FAILED=true
    fi
elif [[ "$DB_TARGET" == "f3auth" ]]; then
    if ! seed_db "f3auth" "$SNAPSHOT_PATH"; then
        SEED_FAILED=true
    fi
else
    if ! seed_db "f3prod" "$SNAPSHOT_PATH"; then
        SEED_FAILED=true
    fi
fi

echo ""
if [[ "$SEED_FAILED" == "true" ]]; then
    echo "Some databases failed to seed. Check the output above."
    exit 1
fi

echo "Local databases seeded. Ensure .env.local has:"
echo "  LOCAL_DATABASE_URL=postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev"
echo "  LOCAL_F3_DATABASE_URL=postgresql://f3prod:f3prod_local_dev@localhost:5433/f3prod_dev"
