#!/usr/bin/env bash
# Zaustavi obe storitvi

for f in /tmp/tasty-backend.pid /tmp/tasty-frontend.pid; do
    if [ -f "$f" ]; then
        pid=$(cat "$f")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "Ustavil PID $pid"
        fi
        rm -f "$f"
    fi
done

# Ustavi morebitne ostanke
pkill -f "node dev.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
echo "✅ Vse zaustavljeno"
