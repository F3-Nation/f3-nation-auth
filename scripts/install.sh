#!/usr/bin/env bash

APPS=("auth-provider" "auth-client" "auth-sdk")

echo "# 📦 Installing dependencies for all applications..."

for app in "${APPS[@]}"; do
    if [ ! -d "$app" ]; then
        echo "Error: Directory $app does not exist"
        exit 1
    fi
    
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
