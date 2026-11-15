#!/bin/sh
set -e

# El esquema se aplica como un paso explícito del despliegue. Ejecutar `db:push`
# en cada arranque puede alterar o bloquear una base de datos de producción.
echo "[el_corral] Se espera que el esquema y las migraciones ya estén aplicados."

if [ "${AUTO_MIGRATE_ON_BOOT:-false}" = "true" ]; then
  echo "[el_corral] AUTO_MIGRATE_ON_BOOT=true: ejecutando db:bootstrap (migraciones + semilla base + admin opcional)..."
  npm run db:bootstrap || {
    echo "[el_corral] Error ejecutando db:bootstrap en arranque."
    exit 1
  }
else
  # Siembra idempotente: crea parámetros globales y planes de vacunación solo
  # cuando faltan. Nunca sobrescribe valores editados ni borra datos.
  # No es bloqueante: si falla, la app arranca con los valores por defecto.
  echo "[el_corral] Sembrando configuración inicial (idempotente)..."
  npm run db:seed-config || echo "[el_corral] Aviso: no se pudo sembrar configuración; se usan valores por defecto."
fi

echo "[el_corral] Arrancando servidor Next.js en producción..."
exec npm start
