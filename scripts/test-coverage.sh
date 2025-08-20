#!/bin/bash

# Script to check test coverage across all apps and fail if below 80%
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the shared apps configuration
source "$SCRIPT_DIR/apps.conf"

echo "# 📊 Checking test coverage across all applications..."

# Validate that all apps exist
validate_apps

threshold=80
overall_failed=false

for app in "${APPS[@]}"; do
    
    cd "$app" || exit 1
    echo "## 📊 Checking coverage for $app..."

    # Run the coverage command and capture output
    coverage_output=$(npm run test:coverage 2>&1)

    # Extract the coverage percentages from the output
    # Look for the "All files" line and extract the percentages
    coverage_line=$(echo "$coverage_output" | grep "All files" | head -1)

    if [ -z "$coverage_line" ]; then
        echo "Error: Could not find coverage data in output for $app"
        echo "$coverage_output"
        exit 1
    fi

    # Extract percentages using awk
    # The format is: All files | % Stmts | % Branch | % Funcs | % Lines |
    statements=$(echo "$coverage_line" | awk -F'|' '{print $2}' | tr -d ' ')
    branches=$(echo "$coverage_line" | awk -F'|' '{print $3}' | tr -d ' ')
    functions=$(echo "$coverage_line" | awk -F'|' '{print $4}' | tr -d ' ')
    lines=$(echo "$coverage_line" | awk -F'|' '{print $5}' | tr -d ' ')

    echo "Coverage Summary for $app:"
    echo "  Statements: ${statements}%"
    echo "  Branches:   ${branches}%"
    echo "  Functions:  ${functions}%"
    echo "  Lines:      ${lines}%"

    # Check if any metric is below threshold
    app_failed=false

    if (( $(echo "$statements < $threshold" | bc -l) )); then
        echo "❌ Statements coverage ($statements%) is below threshold ($threshold%)"
        app_failed=true
    fi

    if (( $(echo "$branches < $threshold" | bc -l) )); then
        echo "❌ Branches coverage ($branches%) is below threshold ($threshold%)"
        app_failed=true
    fi

    if (( $(echo "$functions < $threshold" | bc -l) )); then
        echo "❌ Functions coverage ($functions%) is below threshold ($threshold%)"
        app_failed=true
    fi

    if (( $(echo "$lines < $threshold" | bc -l) )); then
        echo "❌ Lines coverage ($lines%) is below threshold ($threshold%)"
        app_failed=true
    fi

    if [ "$app_failed" = true ]; then
        echo "❌ $app coverage check failed!"
        overall_failed=true
    else
        echo "✅ $app coverage meets the $threshold% threshold!"
    fi
    
    cd .. || exit 1
    echo ""
done

if [ "$overall_failed" = true ]; then
    echo "❌ Coverage check failed! One or more applications have metrics below the $threshold% threshold."
    echo "Please add more tests to improve coverage."
    exit 1
else
    echo "✅ All applications meet the $threshold% coverage threshold!"
    exit 0
fi
