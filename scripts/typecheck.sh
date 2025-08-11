#!/usr/bin/env bash

APPS=("auth-provider" "auth-client" "auth-sdk")

echo "# 🔍 Type checking all applications..."

for app in "${APPS[@]}"; do
    if [ ! -d "$app" ]; then
        echo "Error: Directory $app does not exist"
        exit 1
    fi
    
    cd "$app" || exit 1
    echo "## 🔍 Type checking $app..."

    npm run typecheck
    
    if [ $? -ne 0 ]; then
        echo "Error: npm run typecheck failed for $app"
        exit 1
    fi
    
    cd .. || exit 1
    echo "✔️ Successfully type checked $app"
    echo ""
done

echo "✅ All applications type checked successfully!"
