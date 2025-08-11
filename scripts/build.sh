#!/usr/bin/env bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the shared apps configuration
source "$SCRIPT_DIR/apps.conf"

echo "# 🔄 Building all applications..."

# Validate that all apps exist
validate_apps

for app in "${APPS[@]}"; do
    
    cd "$app" || exit 1
    echo "## 🔄 Building $app..."

    npm run build
    
    if [ $? -ne 0 ]; then
        echo "Error: npm run build failed for $app"
        exit 1
    fi
    
    cd .. || exit 1
    echo "✔️ Successfully built $app"
    echo ""
done

echo "✅ All applications built successfully!"
