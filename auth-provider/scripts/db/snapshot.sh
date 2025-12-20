#!/bin/bash
set -euo pipefail

# Pull database snapshot from remote DATABASE_URL
# Usage: ./scripts/db/snapshot.sh [--type full|schema|data]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
SNAPSHOTS_DIR="$PROJECT_DIR/db-snapshots"

# Parse arguments
DUMP_TYPE="full"
while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            DUMP_TYPE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--type full|schema|data]"
            exit 1
            ;;
    esac
done

if [[ ! "$DUMP_TYPE" =~ ^(full|schema|data)$ ]]; then
    echo "Error: Invalid dump type '$DUMP_TYPE'. Must be: full, schema, or data"
    exit 1
fi

# Load environment variables
if [[ -f "$PROJECT_DIR/.env.local" ]]; then
    set -a
    source "$PROJECT_DIR/.env.local"
    set +a
elif [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL is not set"
    echo "Please set it in .env.local or .env"
    exit 1
fi

# Check for pg_dump
if ! command -v pg_dump &> /dev/null; then
    echo "Error: pg_dump not found"
    echo "Install PostgreSQL client tools:"
    echo "  macOS: brew install libpq && brew link --force libpq"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Create timestamped snapshot directory
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
SNAPSHOT_DIR="$SNAPSHOTS_DIR/$TIMESTAMP"
mkdir -p "$SNAPSHOT_DIR"

echo "Creating database snapshot..."
echo "  Type: $DUMP_TYPE"
echo "  Directory: $SNAPSHOT_DIR"

# Dump schema
if [[ "$DUMP_TYPE" == "full" || "$DUMP_TYPE" == "schema" ]]; then
    echo "  Dumping schema..."
    pg_dump "$DATABASE_URL" \
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
    pg_dump "$DATABASE_URL" \
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
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
echo "  Created metadata.json"

# Update latest symlink
rm -f "$SNAPSHOTS_DIR/latest"
ln -s "$TIMESTAMP" "$SNAPSHOTS_DIR/latest"
echo "  Updated 'latest' symlink"

echo ""
echo "Snapshot complete: $SNAPSHOT_DIR"
echo "Use 'npm run db:local:seed' to load into local database"
