## Issue / Alcance
<!-- Ejemplo: SEC-01, NORM-01, NAV-01, SEO-01 -->
- Issue asociado:
- Commit base:

## Problema y evidencia
<!-- Describe brevemente el hallazgo o mejora y la evidencia verificada antes del cambio -->

## Archivos modificados y solución
<!-- Lista de archivos principales y decisiones tomadas (y alternativas descartadas si aplica) -->

## Riesgos y compatibilidad
- [ ] No expone secretos, credenciales, tokens ni datos personales reales de productores.
- [ ] No modifica datos de producción ni reglas sanitarias/financieras sin aprobación humana expresa.
- [ ] Conserva las rutas públicas, la privacidad del `/dashboard` y el licenciamiento Open-Core.

## Verificación ejecutada
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test` (contra base aislada `el_gallinero_test`)
- [ ] `npm run build` *(si aplica)*

## Impacto y reversión
- Impacto en `sitemap.xml` / `robots.txt` / `llms.txt` / Schema.org:
- Procedimiento de reversión: `git revert <commit>` (sin alteraciones destructivas de esquema).
