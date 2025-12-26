#!/bin/bash
set -euo pipefail

# Pull database snapshot from production databases defined in .env.firebase
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

# Load production database URLs from .env.firebase (source of truth for snapshots)
ENV_FILE="$PROJECT_DIR/.env.firebase"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: .env.firebase not found at $ENV_FILE"
    echo "This file should contain production DATABASE_URL and F3_DATABASE_URL"
    exit 1
fi

[[ -z "${DATABASE_URL:-}" ]] && DATABASE_URL=$(load_env_var "DATABASE_URL" "$ENV_FILE")
[[ -z "${F3_DATABASE_URL:-}" ]] && F3_DATABASE_URL=$(load_env_var "F3_DATABASE_URL" "$ENV_FILE")

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
        echo "Please set it in .env.firebase"
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

    # Determine what to dump based on database
    # For f3prod: dynamically discover auth_* tables plus users table from public schema
    local dump_tables=""
    local dump_table_patterns=""
    if [[ "$db_name" == "f3prod" ]]; then
        # Will be resolved dynamically: all auth_* tables + users table
        dump_table_patterns="auth_% users"
    fi

    # Resolve table patterns to actual table names
    if [[ -n "$dump_table_patterns" ]]; then
        local where_clauses=""
        for pattern in $dump_table_patterns; do
            if [[ -n "$where_clauses" ]]; then
                where_clauses="$where_clauses OR "
            fi
            if [[ "$pattern" == *"%"* ]]; then
                where_clauses="${where_clauses}tablename LIKE '$pattern'"
            else
                where_clauses="${where_clauses}tablename = '$pattern'"
            fi
        done
        dump_tables=$(psql "$clean_url" -t -c "SELECT 'public.' || tablename FROM pg_tables WHERE schemaname = 'public' AND ($where_clauses) ORDER BY tablename" 2>/dev/null | tr -d ' ' | grep -v '^$' | tr '\n' ' ')
        echo "  Tables to dump: $dump_tables"
    fi

    # Dump schema
    if [[ "$DUMP_TYPE" == "full" || "$DUMP_TYPE" == "schema" ]]; then
        echo "  Dumping schema..."
        local schema_args=()

        if [[ -n "$dump_tables" ]]; then
            # Dump specific tables only
            for table in $dump_tables; do
                schema_args+=(--table="$table")
            done
        else
            # Dump entire public schema
            schema_args+=(--schema=public)
        fi

        pg_dump "$clean_url" \
            --schema-only \
            --no-owner \
            --no-privileges \
            --no-comments \
            "${schema_args[@]}" \
            > "$SNAPSHOT_DIR/schema.sql" 2>/dev/null
        echo "    Created schema.sql ($(wc -c < "$SNAPSHOT_DIR/schema.sql" | tr -d ' ') bytes)"
    fi

    # Dump data
    if [[ "$DUMP_TYPE" == "full" || "$DUMP_TYPE" == "data" ]]; then
        echo "  Dumping data..."

        if [[ -n "$dump_tables" ]]; then
            # For specific tables: try pg_dump first, fall back to CSV export
            local table_args=()
            for table in $dump_tables; do
                table_args+=(--table="$table")
            done

            local stderr_file="$SNAPSHOT_DIR/.dump_stderr"
            # Allow pg_dump to fail - we'll check stderr and use fallback
            pg_dump "$clean_url" \
                --data-only \
                --no-owner \
                --no-privileges \
                --inserts \
                "${table_args[@]}" \
                > "$SNAPSHOT_DIR/data.sql" 2> "$stderr_file" || true

            if grep -q "permission denied for sequence" "$stderr_file" 2>/dev/null; then
                echo "    pg_dump failed (sequence permissions), using CSV fallback..."
                rm -f "$SNAPSHOT_DIR/data.sql"
                mkdir -p "$SNAPSHOT_DIR/csv"

                # Export each table as CSV
                for table in $dump_tables; do
                    local csv_file="$SNAPSHOT_DIR/csv/${table//\./_}.csv"
                    psql "$clean_url" -c "COPY $table TO STDOUT WITH (FORMAT CSV, HEADER)" > "$csv_file" 2>/dev/null
                    local row_count=$(( $(wc -l < "$csv_file" | tr -d ' ') - 1 ))
                    echo "    Exported $table ($row_count rows)"
                done

                # Create a load script
                cat > "$SNAPSHOT_DIR/data.sql" << 'LOADER'
-- Data exported as CSV files in csv/ subdirectory
-- This file is a placeholder - use the seed script to load CSV data
-- CSV files: csv/*.csv
LOADER
            fi
            rm -f "$stderr_file"
        else
            # For full schema dump: use pg_dump
            pg_dump "$clean_url" \
                --data-only \
                --no-owner \
                --no-privileges \
                --inserts \
                --schema=public \
                > "$SNAPSHOT_DIR/data.sql" 2>/dev/null
        fi

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
