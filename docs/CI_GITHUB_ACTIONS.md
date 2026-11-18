# CI de El Gallinero: paso 0

Este paquete propone `.github/workflows/ci.yml` para el repositorio `Camilosal/El-Gallinero`.

## Comprobaciones

- `quality`: Node.js 22, `npm ci`, ESLint, TypeScript y `next build`.
- `tests`: PostgreSQL 16 **efímero** con la base `gallinero_ci`; inicializa esquema (`db:push -- --force`), aplica migraciones (`db:migrate`), crea datos sintéticos con `db:seed -- --allow-destructive` y ejecuta `npm test` (Vitest).
- Eventos: PR hacia `main`, push a `main` y activación manual desde GitHub Actions una vez incorporado el workflow a la rama predeterminada.
- Permisos mínimos: `contents: read`; no usa acciones de despliegue, claves externas ni secretos.
- Las contraseñas incluidas en el workflow son datos de **prueba** públicos y se usan solo en un contenedor temporal; nunca deben reutilizarse.

## Publicación manual mediante GitHub

1. Crear una rama `chore/ci-github-actions-baseline` desde `main`.
2. Añadir los archivos del paquete a las mismas rutas del repositorio.
3. Crear un PR de esta rama hacia `main`, sin hacer merge todavía.
4. Revisar en la pestaña **Checks** los trabajos `Lint, TypeScript and build` y `Vitest with disposable PostgreSQL`.
5. Corregir fallos de baseline en un PR distinto o documentarlos antes de bloquear la rama.
6. Tras aprobar el CI y fusionar de forma humana, establecer los jobs como comprobaciones requeridas en las reglas de protección de `main`, si la configuración del repositorio lo permite.

## Consideraciones y límites

- La conexión GitHub usada para preparar este paquete devolvió `403 Resource not accessible by integration` al intentar crear una rama. **Estos archivos aún no están en el repositorio** y los workflows no se han ejecutado.
- El `next build` usa el mismo URL no productivo de compilación que el `Dockerfile` actual. Si una ruta empieza a necesitar consultas de DB en la compilación, ajustar el workflow para usar solo una base aislada de CI.
- Las pruebas E2E existentes **no se activan**: `tests/e2e/auth.setup.ts` exige `E2E_ADMIN_PASSWORD` o `DEMO_ADMIN_PASSWORD`, y `playwright.config.ts` presenta una discrepancia entre `baseURL` (puerto 3001) y el servicio (puerto 4327). Se recomienda corregir esto antes de añadir un job de Playwright, utilizando exclusivamente datos de prueba y sin credenciales reales.
- Algunos tests pueden fallar porque los scripts de esquema, migraciones y datos semilla del repositorio no han sido ejecutados juntos en este entorno. El CI debe considerarse **pendiente de primera ejecución**, no aprobado.
- Nunca cambiar `DATABASE_URL` de los tests a la base `el_gallinero` de producción. El guard de Vitest ya bloquea ese nombre de base.

## Próximo paso (artículo visual)

En el PR del artículo de costo por huevo, agregar tests Vitest para fórmulas, límites numéricos, etiquetas de procedencia y conservación del slug; los jobs existentes ejecutarán esos tests automáticamente. Añadir un job E2E público específico para comprobar diseño y accesibilidad cuando el artículo esté implementado.
