# Contribuyendo a El Gallinero

¡Gracias por tu interés en contribuir a El Gallinero! Este documento proporciona directrices y pasos para contribuir al proyecto.

## Cómo Contribuir

### Reportando Issues
Antes de crear un issue, por favor revisa si ya existe uno similar en la lista de [issues](https://github.com/Camilosal/El-Gallinero/issues).

Al crear un issue, incluye:
- Una descripción clara y concisa del problema o sugerencia
- Pasos para reproducir el problema (si aplica)
- Capturas de pantalla o videos (si es relevante)
- Tu entorno (Node.js version, PostgreSQL version, navegador, sistema operativo)
- Comportamiento esperado vs comportamiento actual

### Sugiriendo Mejoras
Las sugerencias de mejora son bienvenidas. Por favor, abre un issue etiquetado como `enhancement` y proporciona:
- Una descripción detallada de la característica propuesta
- Casos de uso y beneficios esperados
- Posibles desafíos o consideraciones de implementación
- Ejemplos o bocetos si aplica

### Enviando Pull Requests
1. Haz un fork del repositorio
2. Crea una rama nueva desde `main`: `git checkout -b feature/nombre-de-tu-feature`
3. Realiza tus cambios
4. Asegúrate de que tu código siga las guías de estilo (ver abajo)
5. Escribe o actualiza pruebas según corresponda
6. Ejecuta el suite de pruebas para asegurar que nada se rompa
7. Haz commit de tus cambios con un mensaje descriptivo
8. Sube tu rama: `git push origin feature/nombre-de-tu-feature`
9. Abre un Pull Request contra la rama `main` del repositorio original

## Guía de Estilo de Código

### TypeScript y JavaScript
- Usamos TypeScript estricto (`tsc --noEmit` debe pasar sin errores)
- Sigue las convenciones de ESLint configuradas en `.eslintrc.mjs`
- Prefiero usar interfaces sobre types cuando corresponde
- Usa arrow functions para callbacks simples
- Evita `any` tanto como sea posible
- Usa descriptivos nombres de variables y funciones en inglés

### CSS y Tailwind
- Usamos Tailwind CSS 4
- Prefiere clases utilitarias de Tailwind sobre CSS custom cuando es posible
- Para estilos complejos, usa el archivo CSS global o módulos CSS
- Mantén las clases organizadas y legibles

### Commits
- Usa mensajes de commit claros y concisos en inglés
- Formato recomendado: `tipo(ámbito): descripción`
  - Ejemplo: `feat(gallinas): agrega validación de peso máximo`
  - Ejemplo: `fix(alimentacion): corrige cálculo de stock mínimo`
- Tipos comunes: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Si tu cambio rompe compatibilidad hacia atrás, inicia con `BREAKING CHANGE:` en el cuerpo del commit

## Pruebas

### Pruebas Unitarias y de Integración
- Las pruebas se escriben con Vitest
- Archivos de prueba están en el directorio `tests/` o junto al archivo que prueban (`*.test.ts`)
- Para ejecutar pruebas: `npm run test`
- Para modo watch: `npm run test:watch`
- Para cobertura: `npm run test -- --coverage`

### Buenas Prácticas
- Escribe pruebas para nuevas funcionalidades
- Actualiza pruebas existentes cuando modifiques funcionalidad
- Enfócate en probar lógica de negocio, no solo cobertura
- Usa mocks apropiadamente para dependencias externas
- Prueba casos edge y condiciones de error

## Documentación

### Documentación de Código
- Usa JSDoc para funciones y componentes públicos
- Documenta parámetros, retornos y posibles errores
- Mantén la documentación actualizada con los cambios de código

### Documentación del Usuario
- Los cambios significativos deben reflejarse en el `README.md`
- Características nuevas pueden requerir actualización en la sección de Módulos
- Cambios en la estructura del proyecto deben actualizarse en la sección Estructura del Proyecto
- Actualiza el diccionario de datos (`docs/data-dictionary.md`) si cambias el esquema de base de datos

## Proceso de Revisión de Pull Requests

1. **Revisión Automática**: GitHub Actions ejecutará pruebas y linting
2. **Revisión Manual**: Al menos un mantenedor revisará tu PR
3. **Criterios de Aprobación**:
   - El código debe compilar sin errores (`npm run typecheck`)
   - Las pruebas deben pasar (`npm run test`)
   - No deben introducir nuevas advertencias de ESLint
   - Debe seguir las guías de estilo establecidas
   - Debe incluir documentación adecuada cuando corresponda
   - Los cambios deben estar bien probados
4. **Merge**: Una vez aprobado, un mantenedor hará merge de tu PR

## Preguntas Frecuentes

### ¿Necesito firmar un CLA?
No, actualmente no requerimos un Contributor License Agreement.

### ¿Puedo contribuir con documentación?
¡Absolutamente! La documentación es tan importante como el código.

### ¿Qué hago si mi PR está en conflicto con main?
Actualiza tu rama: `git fetch origin && git rebase origin/main`

### ¿Cuánto tiempo tarda la revisión?
Dependiendo de la complejidad, normalmente entre 1-3 días hábiles.

### ¿Puedo trabajar en issues etiquetados como "good first issue"?
Sí, esos están específicamente diseñados para nuevos contribuidores.

## Comunidad

- Sé respetuoso y constructivo en todas las interacciones
- Enfócate en el código, no en la persona
- Acepta críticas constructivas con gratitud
- Ayuda a otros cuando puedas
- Recuerda que somos una comunidad diversa

## Preguntas

Si tienes preguntas durante el proceso de contribución, no dudes en:
- Comentar en tu Pull Request
- Abrir un issue etiquetado como `question`
- Contactar a los mantenedores directamente

¡Gracias por contribuir a hacer El Gallinero mejor para todos!