#!/usr/bin/env bash

APPS=("auth-provider" "auth-client" "auth-sdk")

echo "# ✨ Formatting all applications..."

for app in "${APPS[@]}"; do
    if [ ! -d "$app" ]; then
        echo "Error: Directory $app does not exist"
        exit 1
    fi
    
    cd "$app" || exit 1
    echo "## ✨ Formatting $app..."

    npm run format
    
    if [ $? -ne 0 ]; then
        echo "Error: npm run format failed for $app"
        exit 1
    fi
    
    cd .. || exit 1
    echo "✔️ Successfully formatted $app"
    echo ""
done

echo "✅ All applications formatted successfully!"
