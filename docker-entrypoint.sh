#!/bin/sh
set -e

echo "[el_gallinero] Aplicando esquema a la base de datos (db:push)..."
npm run db:push

# Siembra idempotente: crea parámetros globales y planes de vacunación solo
# cuando faltan. Nunca sobrescribe valores editados ni borra datos.
# No es bloqueante: si falla, la app arranca con los valores por defecto.
echo "[el_gallinero] Sembrando configuración inicial (idempotente)..."
npm run db:seed-config || echo "[el_gallinero] Aviso: no se pudo sembrar configuración; se usan valores por defecto."

echo "[el_gallinero] Arrancando servidor Next.js en producción..."
exec npm start
