#!/usr/bin/env bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the shared apps configuration
source "$SCRIPT_DIR/apps.conf"

echo "# 📦 Installing dependencies for all applications..."

# Validate that all apps exist
validate_apps

for app in "${APPS[@]}"; do
    
    cd "$app" || exit 1
    echo "## 📦 Installing dependencies for $app..."

    npm install
    
    if [ $? -ne 0 ]; then
        echo "Error: npm install failed for $app"
        exit 1
    fi
    
    cd .. || exit 1
    echo "✔️ Successfully installed dependencies for $app"
    echo ""
done

echo "✅ All dependencies installed successfully!"
