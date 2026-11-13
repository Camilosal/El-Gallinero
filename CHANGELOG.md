# Changelog

Todos los cambios notables del Core Abierto de **El Gallinero** se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [1.1.0] - 2026-11-13

### Agregado
- **Plataforma Multi-Especie (6 especies):** modelo polimórfico Lote + Individuo para gallinas ponedoras, pollos de engorde, codornices, patos, conejos y cuyes/curíes con trazabilidad genética de 3 generaciones y control de consanguinidad.
- **PWA Offline-First e IndexedDB:** copia completa navegable en dispositivo, cola de sincronización idempotente (`Outbox`) y notas de voz grabadas en campo sin cobertura.
- **Gina (Asistente Operativa):** personaje cercano (gallina con gafas) con consulta de datos en tiempo real, lectura OCR de facturas/etiquetas con cámara, memoria persistente por finca, dictado por voz y tarjeta de confirmación obligatoria antes de escribir.
- **Onboarding Progresivo (Pequeño vs. Mediano):** Asistente inicial Día 1 en 3 pasos (con importación CSV), selector de escala en tiempo real, 4 módulos core siempre activos y 5 módulos progresivos desbloqueables por crecimiento o manualmente.
- **Estándares Técnicos y Normativos:** clasificación NTC 1240 (Jumbo a C) en stock PEPS, listas POE GAB y bienestar animal (ICA Res. 3651/3652, 205/2022 y 8452/2025), compostaje térmico AGROSAVIA, cierre diario auditable con hash e integración IoT (ITH, NH3, báscula), contabilidad analítica con prorrateo de indirectos y soberanía alimentaria.
- **Guía de Usuario Completa (45 artículos):** manual público (`/guia`) e interno (`/dashboard/guia`) actualizado con capturas reales, diagramas de flujo y buscador completo.
- **Formalización Open-Core y Licenciamiento Dual:** incorporación de [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) y [docs/estrategia-open-core.md](docs/estrategia-open-core.md) junto a la licencia base [GNU AGPLv3](LICENSE), actualizando [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) y [docs/features.md](docs/features.md).

### Cambiado
- **Tablero Inicio refinado:** grupos visuales enmarcados sin numeración (`Resumen del día`, `Tareas de hoy`, `Accesos directos`), paneles plegables estándar (`Resumen del mes` y `Completar configuración`), barra lateral depurada, accesos de **`+ Crear`** abriendo formularios/modales directamente y sección **`Escanear`** unificada multiespecie.
- **Atribución y divulgación:** canalización web oficial mediante [camilosaldarriaga.com](https://camilosaldarriaga.com) y GitHub Security Advisories, eliminando placeholders y correos directos de interfaz pública/interna.

## [1.0.0] - 2026-08-08
### Agregado
- Lanzamiento inicial de El Gallinero.
- Sistema de gestión avícola completo (producción, inventarios, sanidad, operaciones, finanzas, análisis y configuración).
- Integración automática de finanzas con todas las operaciones y diccionario de datos inicial.
- Licencia GNU AGPLv3.
