#!/bin/sh
set -e

# El esquema se aplica como un paso explícito del despliegue. Ejecutar `db:push`
# en cada arranque puede alterar o bloquear una base de datos de producción.
echo "[el_corral] Se espera que el esquema y las migraciones ya estén aplicados."

if [ "${AUTO_MIGRATE_ON_BOOT:-false}" = "true" ]; then
  echo "[el_corral] AUTO_MIGRATE_ON_BOOT=true: ejecutando db:bootstrap (migraciones + semilla inicial + admin opcional)..."
  npm run db:bootstrap || {
    echo "[el_corral] Error ejecutando db:bootstrap en arranque."
    exit 1
  }
else
  # En instancias existentes, los cambios de esquema y la configuración se
  # aplican como pasos explícitos. Arrancar no debe sembrar ni modificar datos.
  echo "[el_corral] Inicio sin migraciones ni siembra automática."
fi

echo "[el_corral] Arrancando servidor Next.js en producción..."
exec npm start
