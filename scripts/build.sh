#!/usr/bin/env bash

APPS=("auth-provider" "auth-client" "auth-sdk")

echo "# 🔄 Building all applications..."

for app in "${APPS[@]}"; do
    if [ ! -d "$app" ]; then
        echo "Error: Directory $app does not exist"
        exit 1
    fi
    
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
