#!/usr/bin/env bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the shared apps configuration
source "$SCRIPT_DIR/apps.conf"

echo "# 🧪 Testing all applications..."

# Validate that all apps exist
validate_apps

for app in "${APPS[@]}"; do
    
    cd "$app" || exit 1
    echo "## 🧪 Testing $app..."

    npm run test
    
    if [ $? -ne 0 ]; then
        echo "Error: npm run test failed for $app"
        exit 1
    fi
    
    cd .. || exit 1
    echo "✔️ Successfully tested $app"
    echo ""
done

echo "✅ All applications tested successfully!"
