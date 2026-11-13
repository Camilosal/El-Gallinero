# Estrategia Open-Core, Licenciamiento Dual y Gobernanza

Este documento formaliza en el repositorio la estrategia de **Código Base Abierto (Open-Core)** de la plataforma **El Gallinero** para ecosistemas multi-especie (gallinas ponedoras, pollos de engorde, codornices, patos, conejos y cuyes/curíes).

## 1. Propósito Estratégico

La apertura controlada en GitHub bajo modelo **Open-Core + Licenciamiento Dual** busca tres objetivos complementarios:

1. **Adopción real y soberanía tecnológica en campo:** las organizaciones técnicas, extensionistas y productores pueden auditar la arquitectura *offline-first*, los cálculos zootécnicos y las medidas de privacidad sin riesgo de *vendor lock-in*.
2. **Elegibilidad como Bien Público Digital (DPG) y respaldo en convocatorias:** al liberar estándares abiertos bajo **CC-BY-SA 4.0** y el núcleo operativo bajo **GNU AGPLv3** (aprobada por OSI y FSF), el proyecto acredita madurez tecnológica verificable (**TRL 8–9**) y orienta el presupuesto de convocatorias o cooperación hacia servicios de despliegue, M&E, formación y acompañamiento en territorio.
3. **Protección comercial frente a reventa SaaS sin retribución:** el copyleft de red de **GNU AGPLv3 (Art. 13)** protege el núcleo comunitario, mientras la capa comercial/institucional se licencia por separado mediante [COMMERCIAL-LICENSE.md](../COMMERCIAL-LICENSE.md).

---

## 2. Arquitectura de Separación en Tres Capas

| Capa | Alcance | Licencia | Naturaleza en el ecosistema |
| --- | --- | --- | --- |
| **Capa 1 · Estándar Zootécnico y Normativo Abierto** | Curvas productivas y nutricionales de las 6 especies, ajustes por altitud, tabla NTC 1240, reglas POE GAB (ICA Res. 3651/3652), bienestar (Res. 205/2022 y 8452/2025) y compostaje AGROSAVIA. | **CC-BY-SA 4.0** | Base científica auditable y colaborativa abierta a universidades y entidades agropecuarias de Latinoamérica. |
| **Capa 2 · Core Abierto Operativo Monopredio** *(este repositorio)* | Aplicación PWA *offline-first* para una finca: modelo híbrido Lote + Individuo (con consanguinidad de 3 generaciones), captura en campo < 2 min, **Gina**, escáner QR, sanidad/retiros, inventarios FIFO/PEPS y finanzas integradas. | **GNU AGPLv3** | Núcleo público completo, autoalojable y ejecutable en Docker o servidor Node + PostgreSQL. |
| **Capa 3 · Capa Institucional y Comercial (Enterprise)** | Torre de Control Multi-Predio (M&E para 50–500+ granjas), pronóstico agregado de acopio, WhatsApp Cloud API / SMS / IVR gestionado, despliegues *white-label*, SLA y herramientas masivas para extensionistas. | **Licencia Comercial Propietaria** | Repositorio/distribución privada comercializada para proyectos institucionales y medianas/grandes operaciones. |

---

## 3. Alineación con Bienes Públicos Digitales (DPGA)

La arquitectura del core abierto cumple los principios clave de infraestructura pública digital en agricultura familiar y sostenible:

- **Aporte a los ODS:** Seguridad alimentaria, ingresos rurales dignos, formalización productiva y producción sostenible (ODS 1, 2, 5, 8 y 12).
- **Licencias abiertas reconocidas:** Código bajo **GNU AGPLv3** ([LICENSE](../LICENSE)) y conocimiento técnico abierto bajo **CC-BY-SA 4.0**.
- **Privacidad y soberanía del productor:** Control total del despliegue y de la base PostgreSQL sin dependencia forzosa de APIs propietarias de terceros para operar los flujos centrales.
- **Documentación y verificación abierta:** Manual público navegable en `/guia`, diccionario de datos ([data-dictionary.md](data-dictionary.md)), guías de despliegue ([deployment.md](deployment.md)) y suite automatizada de pruebas.

---

## 4. Gobernanza y Seguridad obligatoria en el Repositorio Público

Todo aporte o publicación hacia el repositorio público debe cumplir estrictamente estas cinco reglas de ingeniería:

1. **Separación física de código propietario:** los módulos exclusivos de la capa Enterprise (Torre de Control multi-predio, conectores institucionales y configuraciones privadas de clientes) nunca se alojan en ramas del repositorio comunitario; residen en repositorios separados que consumen el core como base o dependencia versionada.
2. **Cero secretos o credenciales versionadas:** nunca incluir llaves de API, tokens, contraseñas ni archivos `.env` / `.env.local` en el historial de Git; revisar siempre antes de cada commit y usar `.env.example` únicamente con valores de ejemplo.
3. **Datos sintéticos únicamente:** los scripts de siembra (`src/db/seed.ts`, `src/db/seed-config.ts`) y pruebas automatizadas utilizan datos ficticios; jamás almacenar datos reales de predios, clientes o beneficiarios en el repositorio.
4. **Inyección modular limpia:** mantener la capa de negocio del núcleo desacoplada en `src/lib/` y `src/db/` para facilitar tanto despliegues autoalojados como extensiones externas sin bifurcar innecesariamente el núcleo.
5. **Divulgación responsable de vulnerabilidades:** toda falla de seguridad se gestiona en privado antes de publicarse según [SECURITY.md](../SECURITY.md).
