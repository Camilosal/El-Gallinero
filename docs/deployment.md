# Despliegue de producción

El repositorio no contiene configuración versionada para un proveedor de hosting. El despliegue requiere una imagen Docker y PostgreSQL administrado. Configura `DATABASE_URL` como secreto del proveedor; no guardes credenciales en el repositorio ni dentro de la imagen.

## Preparación de base de datos

1. Haz una copia de seguridad y ensaya el cambio sobre una copia reciente de producción.
2. Comprueba que no haya códigos de animal duplicados antes de activar los índices únicos. `scripts/enforce_animal_code_integrity.sql` cancela la operación si los encuentra.
3. Ejecuta estos scripts, en este orden, con `psql` y `ON_ERROR_STOP` activado:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/enforce_animal_code_integrity.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/add_animal_exit_snapshots.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/link_egg_autoconsumo_logs.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/enforce_manure_daily_integrity.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/enforce_manure_factor_integrity.sql
   ```

   `enforce_manure_daily_integrity.sql` se detiene si existen registros automáticos duplicados. `enforce_manure_factor_integrity.sql` conserva el factor editado más recientemente por grupo y etapa y elimina los duplicados restantes; revisa primero esos registros en la copia de ensayo.
4. Compara el esquema desplegado con `src/db/schema.ts`. Ensaya cualquier cambio en una copia reciente y revisa el SQL antes de producción. La imagen de la aplicación no contiene `drizzle-kit`; el arranque no ejecuta `db:push`.
5. Ejecuta `npm run db:seed-config` una vez después de aplicar el esquema. Es idempotente y conserva los valores existentes.
6. Si la base todavía no tiene usuarios, crea el primer administrador con `npm run db:create-admin`, proporcionando `ADMIN_USERNAME` y `ADMIN_PASSWORD` como variables de entorno. La contraseña debe tener al menos 12 caracteres. El comando aborta si ya existe una cuenta.
7. Si la instancia usó el seed anterior, rota la clave de ese administrador con `npm run db:rotate-admin-password`. El comando cambia solo la cuenta indicada y revoca sus sesiones activas.

La clave de bootstrap debe suministrarse al comando de aprovisionamiento desde un entorno seguro; no la incluyas en la imagen ni en archivos versionados.

## Imagen y arranque

Construye y publica la imagen desde el commit que se vaya a desplegar. Proporciona `DATABASE_URL` en el entorno de ejecución. El comando de arranque del contenedor solo inicia el servidor y ejecuta la siembra idempotente de configuración; no modifica el esquema.

Antes de dirigir tráfico a la nueva versión, confirma que el proceso arranca, que puede conectarse a PostgreSQL y que las vistas principales cargan correctamente. El rollback de aplicación debe volver a la imagen anterior; restaura la copia de seguridad solo si la migración de datos no es compatible con esa versión.

## Datos de acceso

No ejecutes `npm run db:seed` en producción. Es un seed de demostración destructivo y está bloqueado cuando `NODE_ENV=production`.
