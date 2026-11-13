# Política de Seguridad

## Versiones Soportadas

Las siguientes ramas/versiones de **El Gallinero (Core Abierto)** reciben actualizaciones de seguridad:

| Versión | Estado |
| --- | --- |
| `1.1.x` (`main`) | ✅ Soportada |
| `< 1.1` | ❌ Sin soporte activo |

## Divulgación Responsable de Vulnerabilidades

La seguridad de los datos productivos, sanitarios y financieros de las granjas es prioritaria. Si detectas una posible vulnerabilidad en el código fuente o en la configuración recomendada, **por favor no la publiques en un Issue abierto ni en redes sociales** antes de coordinar su mitigación.

### Canales privados de reporte

1. **GitHub Security Advisories (preferido):** reporta de forma privada en **[https://github.com/Camilosal/El-Gallinero/security/advisories/new](https://github.com/Camilosal/El-Gallinero/security/advisories/new)**.
2. **Canal web del mantenedor:** si no puedes usar GitHub Advisories, contáctanos a través de **[https://camilosaldarriaga.com](https://camilosaldarriaga.com)** indicando en el asunto `[Seguridad · El Gallinero]`.

Incluye en tu reporte:
- Descripción técnica de la vulnerabilidad y componente/archivo afectado.
- Pasos claros de reproducción o prueba de concepto mínima.
- Impacto potencial (autenticación, aislamiento de datos, inyección, exposición de sesión, sincronización offline, etc.).

## Compromiso de Respuesta

1. Confirmación de recepción dentro de las primeras **48 horas hábiles**.
2. Evaluación de severidad, alcance y reproducción.
3. Desarrollo de corrección, pruebas automatizadas y publicación de parche o aviso coordinado (ventana estándar de divulgación responsable de hasta **90 días**).
4. Reconocimiento público al investigador en las notas de versión si así lo autoriza.

## Buenas Prácticas para Despliegues Autoalojados

- Mantén `DATABASE_URL` y cualquier clave opcional de asistente/voz/OCR exclusivamente en variables de entorno del servidor, nunca en la imagen Docker ni en el repositorio.
- Usa contraseñas de administrador de al menos 12 caracteres (`npm run db:create-admin`) y protege los códigos de recuperación de un solo uso (`/login/recuperar`).
- Ejecuta las instancias detrás de HTTPS/TLS válido para proteger tanto cookies `HttpOnly` de sesión como la caché PWA (`Service Worker` / `IndexedDB`).
