#!/bin/sh
set -e

echo "[el_gallinero] Aplicando esquema a la base de datos (db:push)..."
npm run db:push

echo "[el_gallinero] Arrancando servidor Next.js en producción..."
exec npm start
