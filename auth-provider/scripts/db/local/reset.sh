#!/bin/bash
set -euo pipefail

# Full reset: stop, remove data, start, and seed
# Usage: ./scripts/db/local/reset.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Performing full database reset..."
echo ""

# Stop and remove data
"$SCRIPT_DIR/down.sh" --remove-data

echo ""

# Start fresh
"$SCRIPT_DIR/up.sh"

echo ""

# Seed from latest snapshot
"$SCRIPT_DIR/seed.sh"
