#!/usr/bin/env bash
# Tasty Station POS — lokalni zagon
# Uporaba:  ./start.sh
# Zaustavitev:  ./stop.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Tasty Station POS — zagon"

# 1. Backend (avtomatsko seed-a če je DB prazen; fallback na in-memory MongoDB)
echo "▶  Backend (port 3000)…"
cd "$ROOT/backend"
node dev.js > /tmp/tasty-backend.log 2>&1 &
echo $! > /tmp/tasty-backend.pid
echo "   PID: $(cat /tmp/tasty-backend.pid)"
echo "   Log: /tmp/tasty-backend.log"

# Počakaj da backend zažene
sleep 5
if curl -s http://localhost:3000/ > /dev/null; then
    echo "   ✅ Backend ready"
else
    echo "   ⚠️  Backend še starta — preveri /tmp/tasty-backend.log"
fi

# 2. Frontend
echo "▶  Frontend (port 5173)…"
cd "$ROOT/frontend"
npm run dev > /tmp/tasty-frontend.log 2>&1 &
echo $! > /tmp/tasty-frontend.pid
echo "   PID: $(cat /tmp/tasty-frontend.pid)"
sleep 4

echo ""
echo "🎉  Aplikacija teče!"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3000"
echo ""
echo "   Demo logini (geslo za vse: password123):"
echo "     admin@pos.com    (admin)"
echo "     sarah@pos.com    (manager)"
echo "     john@pos.com     (cashier)"
echo "     michael@pos.com  (waiter)"
echo "     gordon@pos.com   (kitchen)"
echo ""
echo "   Za zaustavitev:  ./stop.sh"
