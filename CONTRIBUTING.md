# Contribuyendo a El Gallinero (Core Abierto)

¡Gracias por tu interés en mejorar **El Gallinero**! Este repositorio aloja el **Core Abierto Operativo (GNU AGPLv3)** dentro de una arquitectura [Open-Core de 3 capas](docs/estrategia-open-core.md). Damos la bienvenida tanto a contribuciones de software como a mejoras zootécnicas, curvas productivas y adaptaciones normativas para Latinoamérica.

---

## Formas de Contribuir

### 1. Tablas Zootécnicas, Curvas y Normativas LATAM
Valoramos especialmente Pull Requests de universidades, zootecnistas, médicos veterinarios y equipos técnicos que amplíen o calibren:
- Curvas de crecimiento o postura y ajustes por altitud/clima para las 6 especies (gallina, pollo, codorniz, pato, conejo, cuy).
- Parámetros nutricionales (%MS, %PC, energía, vitamina C) o factores sanitarios.
- Adaptaciones regulatorias por país sobre bioseguridad, clasificación comercial de huevo o bienestar animal (p. ej. ICA/ICONTEC en Colombia, SENASA en Perú, AGROCALIDAD en Ecuador, SENASICA en México).

### 2. Reporte de Errores e Issues
Antes de abrir un issue, revisa los [issues existentes](https://github.com/Camilosal/El-Gallinero/issues) e incluye:
- Descripción clara y pasos exactos para reproducirlo.
- Entorno (Node.js, PostgreSQL, navegador o dispositivo móvil si es PWA offline).
- Capturas o logs relevantes (nunca incluyas datos reales de productores, credenciales ni tokens).

### 3. Pull Requests de Código y Documentación
1. Haz un fork del repositorio y crea una rama desde `main` (`git checkout -b feat/mi-mejora` o `fix/mi-correccion`).
2. Respeta la separación de arquitectura **Open-Core**: este repositorio mantiene exclusivamente el núcleo operativo monopredio y utilidades base; no añadas dependencias propietarias cerradas que impidan ejecutar el núcleo bajo GNU AGPLv3.
3. Sigue TypeScript estricto, Tailwind CSS v4 y mantén actualizada la guía de usuario (`src/lib/guide-data.ts`) o el diccionario de datos (`docs/data-dictionary.md`) si modificas rutas o esquema.
4. Ejecuta las validaciones antes de enviar el PR:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```
5. Usa mensajes de commit claros en formato convencional (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`).

---

## Acuerdo de Licencia y Esquema de Licenciamiento Dual

El proyecto opera bajo **Licenciamiento Dual** ([LICENSE](LICENSE) · GNU AGPLv3 + [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)):

- Todo código o mejora publicada en el repositorio público se distribuye bajo **GNU AGPLv3** (y documentación/datos técnicos de referencia compatibles bajo **CC-BY-SA 4.0**).
- Al enviar un Pull Request y solicitar su integración en `main`, el autor declara que su aporte es original (o debidamente licenciado para su incorporación) y concede al mantenedor originario (**Camilo Saldarriaga · [camilosaldarriaga.com](https://camilosaldarriaga.com)**) autorización no exclusiva y perpetua para incluir y distribuir la contribución tanto en la edición pública **GNU AGPLv3** como en distribuciones comerciales licenciadas bajo [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).
- Para aportes institucionales mayores o acuerdos específicos de **CLA**, coordina previamente a través del issue/PR o en **[camilosaldarriaga.com](https://camilosaldarriaga.com)**.

---

## Reglas de Seguridad y Datos en Contribuciones

- **Cero secretos:** nunca hagas commit de claves de API, tokens, contraseñas o archivos `.env*`.
- **Solo datos sintéticos:** cualquier archivo de prueba o `seed` debe usar granjas, personas y códigos ficticios.
- Si descubres una vulnerabilidad de seguridad, **no** abras un issue público; sigue el canal privado en [SECURITY.md](SECURITY.md).

## Trabajo con Base de Datos y Pruebas

- **Migraciones / Esquema:** al cambiar `src/db/schema.ts`, valida el impacto con `npm run db:generate` / `npm run db:push` sobre una base de ensayo local y recuerda documentar scripts SQL idempotentes en `scripts/` y `docs/deployment.md` si aplica a producción.
- **Pruebas:** usa Vitest (`tests/*.test.ts`) apuntando a una base de prueba aislada y verifica el correcto funcionamiento sin regresiones.
