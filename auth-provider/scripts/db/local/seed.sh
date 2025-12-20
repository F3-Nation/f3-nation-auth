#!/bin/bash
set -euo pipefail

# Seed local PostgreSQL from snapshot
# Usage: ./scripts/db/local/seed.sh [snapshot-path]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
SNAPSHOTS_DIR="$PROJECT_DIR/db-snapshots"

# Determine snapshot path
if [[ $# -gt 0 ]]; then
    SNAPSHOT_PATH="$1"
else
    SNAPSHOT_PATH="$SNAPSHOTS_DIR/latest"
fi

# Resolve symlink if needed
if [[ -L "$SNAPSHOT_PATH" ]]; then
    SNAPSHOT_PATH="$SNAPSHOTS_DIR/$(readlink "$SNAPSHOT_PATH")"
fi

if [[ ! -d "$SNAPSHOT_PATH" ]]; then
    echo "Error: Snapshot not found at $SNAPSHOT_PATH"
    echo "Run 'npm run db:snapshot' first to create a snapshot"
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

# Local database connection
LOCAL_DB_URL="postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev"

# Check if local PostgreSQL is running
if ! psql "$LOCAL_DB_URL" -c "SELECT 1" &> /dev/null; then
    echo "Error: Local PostgreSQL is not running"
    echo "Run 'npm run db:local:up' first"
    exit 1
fi

echo "Seeding local database from snapshot..."
echo "  Snapshot: $SNAPSHOT_PATH"

# Check what files exist
HAS_SCHEMA=false
HAS_DATA=false
[[ -f "$SNAPSHOT_PATH/schema.sql" ]] && HAS_SCHEMA=true
[[ -f "$SNAPSHOT_PATH/data.sql" ]] && HAS_DATA=true

if [[ "$HAS_SCHEMA" == "false" && "$HAS_DATA" == "false" ]]; then
    echo "Error: No schema.sql or data.sql found in snapshot"
    exit 1
fi

# Drop and recreate public schema to clear all tables
echo "  Clearing existing data..."
psql "$LOCAL_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null

# Restore schema
if [[ "$HAS_SCHEMA" == "true" ]]; then
    echo "  Restoring schema..."
    psql "$LOCAL_DB_URL" -f "$SNAPSHOT_PATH/schema.sql" > /dev/null
fi

# Restore data
if [[ "$HAS_DATA" == "true" ]]; then
    echo "  Restoring data..."
    psql "$LOCAL_DB_URL" -f "$SNAPSHOT_PATH/data.sql" > /dev/null
fi

echo ""
echo "Database seeded successfully!"
echo ""
echo "To use the local database, update .env.local:"
echo "  DATABASE_URL=postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev"
