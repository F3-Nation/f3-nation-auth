#!/bin/bash
set -euo pipefail

# Full reset: stop, remove data, start, and seed
# Usage: ./scripts/db/local/reset.sh [--db f3auth|f3prod|all]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
DB_TARGET="all"  # Default to seeding both databases after reset

while [[ $# -gt 0 ]]; do
    case $1 in
        --db)
            DB_TARGET="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--db f3auth|f3prod|all]"
            exit 1
            ;;
    esac
done

if [[ ! "$DB_TARGET" =~ ^(f3auth|f3prod|all)$ ]]; then
    echo "Error: Invalid --db value '$DB_TARGET'. Must be: f3auth, f3prod, or all"
    exit 1
fi

echo "Performing full database reset..."
echo "Will seed: $DB_TARGET"
echo ""

# Stop and remove data
"$SCRIPT_DIR/down.sh" --remove-data

echo ""

# Start fresh
"$SCRIPT_DIR/up.sh"

echo ""

# Seed specified database(s)
"$SCRIPT_DIR/seed.sh" --db "$DB_TARGET"
