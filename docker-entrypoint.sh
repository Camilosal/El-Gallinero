#!/bin/sh
set -e

# El esquema se aplica como un paso explícito del despliegue. Ejecutar `db:push`
# en cada arranque puede alterar o bloquear una base de datos de producción.
echo "[el_gallinero] Se espera que el esquema y las migraciones ya estén aplicados."

# Siembra idempotente: crea parámetros globales y planes de vacunación solo
# cuando faltan. Nunca sobrescribe valores editados ni borra datos.
# No es bloqueante: si falla, la app arranca con los valores por defecto.
echo "[el_gallinero] Sembrando configuración inicial (idempotente)..."
npm run db:seed-config || echo "[el_gallinero] Aviso: no se pudo sembrar configuración; se usan valores por defecto."

echo "[el_gallinero] Arrancando servidor Next.js en producción..."
exec npm start
