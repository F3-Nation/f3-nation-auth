#!/usr/bin/env bash

APPS=("auth-provider" "auth-client" "auth-sdk")

echo "# 🔍 Linting all applications..."

for app in "${APPS[@]}"; do
    if [ ! -d "$app" ]; then
        echo "Error: Directory $app does not exist"
        exit 1
    fi
    
    cd "$app" || exit 1
    echo "## 🔍 Linting $app..."

    npm run lint
    
    if [ $? -ne 0 ]; then
        echo "Error: npm run lint failed for $app"
        exit 1
    fi
    
    cd .. || exit 1
    echo "✔️ Successfully linted $app"
    echo ""
done

echo "✅ All applications linted successfully!"
