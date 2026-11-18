# Changelog

Todos los cambios notables del Core Abierto de **IwaGranja** se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [1.2.0] - 2026-11-17

Cierre de Rutas 1 y 2 + armonización transversal del agente, la navegación y la documentación (plan [2026-11-17-cierre-rutas-1-2-armonizacion-agente-navegacion.md](docs/superpowers/plans/2026-11-17-cierre-rutas-1-2-armonizacion-agente-navegacion.md)). Ruta 3 (institucional) permanece congelada.

### Agregado
- **Telemetría de adopción persistida:** captura de tiempo de activación y velocidad de registro (incluido offline) con `GET /api/analisis/adopcion`, tablero `/analisis/adopcion` con los 5 KPIs del Plan Maestro y kit-campo de Semana 4.
- **Gina proactiva:** briefing diario (cron `scripts/agent-proactive-scheduler.mjs` → `/api/cron/agente-proactivo`, 06:00 America/Bogota) con entrega en inbox, push y Telegram saliente; tabla `agent_briefings`.
- **Telegram bidireccional:** webhook `/api/telegram/webhook` con secreto, emparejamiento por `/start CODIGO` (TTL 10 min), comandos `/resumen /parte /estado /ayuda`, confirmaciones de escritura auditadas con `origin=telegram` y `chat_id`; setup con `scripts/telegram-setup.mjs`.
- **API v1 de herramientas del agente:** `GET /api/v1/agent/tools` y `POST /api/v1/agent/tools/{nombre}` con tokens de scopes `agent:read`/`agent:write` (write con expiración obligatoria ≤90 días), rate limit y auditoría `origin=external_agent`.
- **Servidor MCP:** `POST /api/mcp` (Streamable HTTP, JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`) sobre el mismo ejecutor de herramientas.
- **Política de delegación configurable** (`assistant.delegation_policy.v1`, valores `confirm`/`auto`) con piso duro de seguridad inviolable desde UI, voz, Telegram, API y MCP.
- **Herramienta `navegar_app`** con deep-links desde el widget y routing Jev ampliado; corpus de conocimiento del agente actualizado.
- **6 guías nuevas** en `/guia` (asistente avanzado, integraciones ERP/agentes, Telegram, análisis de adopción, kit de campo y nómina) con navegación y buscador armonizados.
- **Protocolo de pilotos** ([docs/pilotos-adopcion-protocolo.md](docs/pilotos-adopcion-protocolo.md)) con criterios operativos de aceptación (≥3 pilotos, ≥21 días, adherencia ≥85%).

### Cambiado
- **Navegación y buscador:** cobertura completa de módulos en menús, sinónimos de campo en el buscador global y prueba anti-regresión de anclas.
- **Documentación viva:** diccionario de datos verificado contra `el_gallinero_test` (72 tablas de dominio, 1013 columnas, fichas de nómina, fuentes externas, briefings y Telegram), features, development (arquitectura del agente + guía de contribución de herramientas), deployment (Telegram, cron, MCP) y `docker-compose.yml` con `TELEGRAM_WEBHOOK_SECRET` y `APP_URL`.
- **SEO/GEO:** `llms.txt` con sección de capacidades agénticas verificables, landing y páginas públicas actualizadas, fechas de sitemap reales y exclusión de rutas privadas garantizada por pruebas.
- **Anexo B de marcha blanca (G2):** checklists manuales de aceptación de los dos extremos (baja apropiación, remoto por Telegram y agéntico/MCP) en el protocolo de pilotos, con registro de resultados y regla de bloqueo ante cualquier fallo.

### Corregido
- **Cuentas por cobrar y pagar por el valor bruto de la factura:** las ventas a crédito (huevos, animales vivos, carne, gallinaza, ingresos generales) registraban el neto tributario como deuda del comprador, restando ICA/retenciones que no descuentan el valor facturado. La deuda vuelve al bruto; el snapshot tributario permanece en la transacción.
- **Sincronización manual del catálogo normativo:** `sync_source` rechazaba `standards_normative_feed` (y vademécum/puente IoT) tras sacarlos del auto-sync, rompiendo el botón de sincronizar de Catálogos → Normas y Guías. Ahora se aceptan todas las fuentes sincronizables bajo demanda.
- **Auto-sync por vencimiento de fuentes externas:** un snapshot expirado (p. ej. clima) ya no se quedaba stale con `external.sync_enabled=false`; el GET vuelve a sanarlo y cada conector sigue respetando el toggle antes de tocar la red.
- **Gating del briefing proactivo:** los hallazgos con rutas bloqueadas para la escala de la granja se filtran antes de narrar y entregar (PEQUENO nunca recibe recomendaciones de módulos no desbloqueados).
- **Descubribilidad de `/finanzas/personal`:** sinónimos de campo (nómina, jornal, salario, prestaciones…) agregados al buscador global; la matriz de armonización de G1 queda sin huecos.
- **Auditoría de confirmaciones remotas por Telegram:** las acciones pendientes creadas por otro canal (API v1 / MCP) y confirmadas con el teclado inline de Telegram quedaban con `origin: telegram` pero `chat_id` en null. Ahora el callback estampa el chat que resuelve la acción (confirmación y cancelación), completando la trazabilidad exigida por C3 paso 8. Detectado en el ensayo técnico B.2; cubierto por prueba de regresión.

## [1.1.0] - 2026-11-13

### Agregado
- **Plataforma Multi-Especie (6 especies):** modelo polimórfico Lote + Individuo para gallinas ponedoras, pollos de engorde, codornices, patos, conejos y cuyes/curíes con trazabilidad genética de 3 generaciones y control de consanguinidad.
- **PWA Offline-First e IndexedDB:** copia completa navegable en dispositivo, cola de sincronización idempotente (`Outbox`) y notas de voz grabadas en campo sin cobertura.
- **Gina (Asistente Operativa):** personaje cercano (gallina con gafas) con consulta de datos en tiempo real, lectura OCR de facturas/etiquetas con cámara, memoria persistente por finca, dictado por voz y tarjeta de confirmación obligatoria antes de escribir.
- **Onboarding Progresivo (Pequeño vs. Mediano):** Asistente inicial Día 1 en 3 pasos (con importación CSV), selector de escala en tiempo real, 4 módulos core siempre activos y 5 módulos progresivos desbloqueables por crecimiento o manualmente.
- **Estándares Técnicos y Normativos:** clasificación NTC 1240 (Jumbo a C) en stock PEPS, listas POE GAB y bienestar animal (ICA Res. 3651/3652, 205/2022 y 8452/2025), compostaje térmico AGROSAVIA, cierre diario auditable con hash e integración IoT (ITH, NH3, báscula), contabilidad analítica con prorrateo de indirectos y soberanía alimentaria.
- **Guía de Usuario Completa (45+ artículos):** manual público (`/guia`) e interno (`/manual`) actualizado con capturas reales, diagramas de flujo y buscador completo.
- **Formalización Open-Core y Licenciamiento Dual:** incorporación de [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) y [docs/estrategia-open-core.md](docs/estrategia-open-core.md) junto a la licencia base [GNU AGPLv3](LICENSE), actualizando [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) y [docs/features.md](docs/features.md).

### Cambiado
- **Tablero Inicio refinado:** grupos visuales enmarcados sin numeración (`Resumen del día`, `Tareas de hoy`, `Accesos directos`), paneles plegables estándar (`Resumen del mes` y `Completar configuración`), barra lateral depurada, accesos de **`+ Crear`** abriendo formularios/modales directamente y sección **`Escanear`** unificada multiespecie.
- **Atribución y divulgación:** canalización web oficial mediante [camilosaldarriaga.com](https://camilosaldarriaga.com) y GitHub Security Advisories, eliminando placeholders y correos directos de interfaz pública/interna.

## [1.0.0] - 2026-08-08
### Agregado
- Lanzamiento inicial de IwaGranja.
- Sistema de gestión avícola completo (producción, inventarios, sanidad, operaciones, finanzas, análisis y configuración).
- Integración automática de finanzas con todas las operaciones y diccionario de datos inicial.
- Licencia GNU AGPLv3.
