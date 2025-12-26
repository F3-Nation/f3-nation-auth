#!/bin/bash
set -euo pipefail

# Pull database snapshot from remote DATABASE_URL or F3_DATABASE_URL
# Usage: ./scripts/db/snapshot.sh [--db f3auth|f3prod|all] [--type full|schema|data]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
SNAPSHOTS_DIR="$PROJECT_DIR/db-snapshots"

# Parse arguments
DUMP_TYPE="full"
DB_TARGET="f3auth"

while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            DUMP_TYPE="$2"
            shift 2
            ;;
        --db)
            DB_TARGET="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--db f3auth|f3prod|all] [--type full|schema|data]"
            exit 1
            ;;
    esac
done

if [[ ! "$DUMP_TYPE" =~ ^(full|schema|data)$ ]]; then
    echo "Error: Invalid dump type '$DUMP_TYPE'. Must be: full, schema, or data"
    exit 1
fi

if [[ ! "$DB_TARGET" =~ ^(f3auth|f3prod|all)$ ]]; then
    echo "Error: Invalid --db value '$DB_TARGET'. Must be: f3auth, f3prod, or all"
    exit 1
fi

# Load specific environment variables safely (avoid sourcing entire file)
load_env_var() {
    local var_name="$1"
    local env_file="$2"
    local value
    # Extract value, handling quotes properly
    value=$(grep "^${var_name}=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2-)
    # Remove surrounding quotes if present
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    echo "$value"
}

ENV_FILE=""
if [[ -f "$PROJECT_DIR/.env.local" ]]; then
    ENV_FILE="$PROJECT_DIR/.env.local"
elif [[ -f "$PROJECT_DIR/.env" ]]; then
    ENV_FILE="$PROJECT_DIR/.env"
fi

if [[ -n "$ENV_FILE" ]]; then
    [[ -z "${DATABASE_URL:-}" ]] && DATABASE_URL=$(load_env_var "DATABASE_URL" "$ENV_FILE")
    [[ -z "${F3_DATABASE_URL:-}" ]] && F3_DATABASE_URL=$(load_env_var "F3_DATABASE_URL" "$ENV_FILE")
fi

# Check for pg_dump
if ! command -v pg_dump &> /dev/null; then
    echo "Error: pg_dump not found"
    echo "Install PostgreSQL client tools:"
    echo "  macOS: brew install libpq && brew link --force libpq"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Function to clean database URL (strip query params except sslmode)
clean_db_url() {
    local db_url="$1"
    local clean_url="${db_url%%\?*}"
    if [[ "$db_url" == *"sslmode="* ]]; then
        local sslmode=$(echo "$db_url" | grep -oE 'sslmode=[^&]+' | head -1)
        clean_url="${clean_url}?${sslmode}"
    fi
    echo "$clean_url"
}

# Function to snapshot a single database
snapshot_db() {
    local db_name="$1"
    local db_url_var="$2"

    # Get the URL from environment variable
    local db_url="${!db_url_var:-}"
    if [[ -z "$db_url" ]]; then
        echo "Error: $db_url_var is not set"
        echo "Please set it in .env.local or .env"
        return 1
    fi

    local clean_url=$(clean_db_url "$db_url")

    # Create per-database snapshot directory
    local DB_SNAPSHOTS_DIR="$SNAPSHOTS_DIR/$db_name"
    local TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
    local SNAPSHOT_DIR="$DB_SNAPSHOTS_DIR/$TIMESTAMP"
    mkdir -p "$SNAPSHOT_DIR"

    echo "Creating $db_name database snapshot..."
    echo "  Source: $db_url_var"
    echo "  Type: $DUMP_TYPE"
    echo "  Directory: $SNAPSHOT_DIR"

    # Dump schema
    if [[ "$DUMP_TYPE" == "full" || "$DUMP_TYPE" == "schema" ]]; then
        echo "  Dumping schema..."
        pg_dump "$clean_url" \
            --schema-only \
            --no-owner \
            --no-privileges \
            --no-comments \
            > "$SNAPSHOT_DIR/schema.sql"
        echo "    Created schema.sql ($(wc -c < "$SNAPSHOT_DIR/schema.sql" | tr -d ' ') bytes)"
    fi

    # Dump data
    if [[ "$DUMP_TYPE" == "full" || "$DUMP_TYPE" == "data" ]]; then
        echo "  Dumping data..."
        pg_dump "$clean_url" \
            --data-only \
            --no-owner \
            --no-privileges \
            --disable-triggers \
            > "$SNAPSHOT_DIR/data.sql"
        echo "    Created data.sql ($(wc -c < "$SNAPSHOT_DIR/data.sql" | tr -d ' ') bytes)"
    fi

    # Create metadata
    cat > "$SNAPSHOT_DIR/metadata.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "type": "$DUMP_TYPE",
  "database": "$db_name",
  "source_var": "$db_url_var",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    echo "  Created metadata.json"

    # Update per-database latest symlink
    rm -f "$DB_SNAPSHOTS_DIR/latest"
    ln -s "$TIMESTAMP" "$DB_SNAPSHOTS_DIR/latest"
    echo "  Updated 'latest' symlink"

    echo ""
    echo "Snapshot complete: $SNAPSHOT_DIR"
}

# Execute based on target
if [[ "$DB_TARGET" == "all" ]]; then
    echo "Snapshotting all databases..."
    echo ""
    snapshot_db "f3auth" "DATABASE_URL"
    echo ""
    snapshot_db "f3prod" "F3_DATABASE_URL"
elif [[ "$DB_TARGET" == "f3auth" ]]; then
    snapshot_db "f3auth" "DATABASE_URL"
else
    snapshot_db "f3prod" "F3_DATABASE_URL"
fi

echo ""
echo "Use 'npm run db:local:seed' or 'npm run db:local:seed:all' to load into local database"
