#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v node >/dev/null
command -v npm >/dev/null
command -v psql >/dev/null
printf '\nATELIER FULL RUNTIME QA\n'
printf '\n[1/7] Node / npm\n'; node -v; npm -v
printf '\n[2/7] Environment files\n'
[[ -f backend/.env ]] || cp backend/.env.example backend/.env
[[ -f frontend/.env.local ]] || cp frontend/.env.local.example frontend/.env.local
if ! grep -q '^JWT_SECRET=' backend/.env; then
  printf 'JWT_SECRET=%s\n' "$(openssl rand -base64 48 | tr -d '\n')" >> backend/.env
fi
printf '\n[3/7] Install all dependencies\n'; npm run install:all
printf '\n[4/7] Generate + deploy + seed database\n'; npm run db:setup
printf '\n[5/7] Production build\n'; npm run build
printf '\n[6/7] Start production services\n'
npm --prefix backend run start > /tmp/atelier-api.log 2>&1 & API_PID=$!
cleanup(){ kill "$API_PID" 2>/dev/null || true; [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true; }
trap cleanup EXIT
for i in {1..90}; do curl -fsS http://127.0.0.1:4000/api/health >/tmp/atelier-health.json && break; sleep 0.5; done
cat /tmp/atelier-health.json
npm --prefix frontend run start > /tmp/atelier-web.log 2>&1 & WEB_PID=$!
for i in {1..90}; do curl -fsS http://127.0.0.1:3000/ >/tmp/atelier-home.html && break; sleep 0.5; done
head -c 200 /tmp/atelier-home.html; echo
printf '\n[7/7] Runtime API + Chromium browser QA\n'; npm run qa:api; npm run qa:browser
printf '\nFULL RUNTIME QA = PASS\n'
