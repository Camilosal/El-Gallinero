# Guía de identidad visual · Iwagé / IwaGranja

> **Sistema:** Agroeditorial Ilustrado · **Versión:** 0.1.0 · **Fecha:** 21 de noviembre de 2026 · **Estado:** línea base para validación en el producto real.

## 1. Propósito y alcance

Convertir una colección de páginas visualmente desconectadas en **un sistema reconocible, sencillo de operar y fácil de mantener**. Aplica primero a IwaGranja: landing, registro/acceso, onboarding, aplicación de campo, dashboards, informes, documentación, microguías y piezas de formación. También establece una base compartida para el ecosistema Iwagé sin borrar las diferencias entre marcas.

**Alcance visual, no funcional.** La guía no certifica que una capacidad de producto ya exista; las muestras son ilustrativas. Mantener la distinción entre funcionalidades implementadas, piloto y futuras.

### Jerarquía de marca

- **Iwagé, marca madre:** territorio, experimentación, sostenibilidad y conocimiento aplicado.
- **IwaGranja, producto digital pecuario:** cercanía con productores + precisión en el registro y las decisiones.
- **Extensiones de Iwagé:** mismas reglas de UX y sistema base, motivos visuales propios únicamente cuando se acuerden y documenten.

**Firma de marca oficial:** `IwaGranja · por Iwagé` en páginas públicas; en la operación, usar el logotipo horizontal o cuadrado oficial de IwaGranja. No fusionar ni alternar nombres sin un estándar de arquitectura de marca.

## 2. Idea rectora

**«El cuaderno de campo del futuro».** Un lenguaje que toma la confianza de los cuadernos de registro, el rigor de las láminas naturalistas y la legibilidad de las aplicaciones modernas.

**Palabras guía:** rural, cálido, observador, didáctico, ingenioso, confiable, contemporáneo.

**No somos:** infantil, folclórico caricaturizado, genérico “eco”, ERP corporativo frío, dashboard futurista de neón ni tienda de productos orgánicos.

### Distribución visual conceptual

- **70% editorial/natural:** proporción, espacios generosos, fondos cálidos, tipografía y escenas de campo.
- **20% señalética agroindustrial:** numeraciones, etiquetas, indicadores, líneas de anotación, fichas y metadatos.
- **10% narrativa/cómic:** secuencias ilustradas, viñetas y microexplicaciones con humor discreto.

Es una **brújula creativa**, no un cálculo por pantalla. En la app operativa, la ilustración debe ocupar significativamente menos espacio que en la landing.

## 3. Principios no negociables

1. **Una sola fuente de tokens.** No definir paletas, tipografías, radios o variantes de botones por página.
2. **La tarea antes del ornamento.** Animales, texturas y tramas nunca obstaculizan lectura, formularios, alertas ni tablas.
3. **Campo real, no caricatura infantil.** La ilustración explica y aproxima; los datos y pantallas reales demuestran.
4. **Diseñado para uso rural.** Alto contraste a plena luz, blancos táctiles de **al menos 48 × 48 px** en operaciones de campo, tolerancia a conectividad intermitente y textos claros.
5. **Semántica estable.** Verde bosque identifica marca/acción, no sustituye por sí solo el significado de “éxito”; alertas sanitarias tienen un lenguaje propio consistente.
6. **Progresión de complejidad.** La landing presenta valor y evidencia; la app muestra lo necesario para completar una tarea.
7. **Accesibilidad y consistencia primero.** Ningún estilo nuevo entra al sistema sin estados y QA.

## 4. Colores

### 4.1. Paleta fundacional

| Token | HEX | Uso aprobado |
|---|---|---|
| `color.forest` | `#315245` | Marca, encabezados breves, CTA principal, iconos destacados |
| `color.forestDark` | `#26463A` | Hover/pressed de acciones principales |
| `color.paper` | `#F3EDE0` | Fondo editorial general |
| `color.paperLight` | `#FCFBF7` | Fondo secundario cálido |
| `color.white` | `#FFFFFF` | Tarjetas y áreas de captura |
| `color.ochre` | `#B17A45` | Acento editorial, etiquetas no críticas, líneas |
| `color.terracotta` | `#C76E4C` | Acento narrativo y elementos destacados no críticos |
| `color.graphite` | `#253238` | Texto principal y tablas |
| `color.muted` | `#536760` | Texto secundario |
| `color.border` | `#C9CEC3` | Contornos y separadores |
| `color.sage` | `#E5EBD8` | Fondo de historias y secciones suaves |

### 4.2. Semántica y accesibilidad

- Primario: `forest` con texto **blanco**. Relación de contraste aproximada `8.67:1`.
- Texto principal `graphite` sobre `paper`: aproximadamente `11.31:1`.
- Texto secundario `muted` sobre `paper`: aproximadamente `5.18:1`.
- **Ocre y terracota NO son colores para texto pequeño sobre blanco o crema ni para botones con texto blanco:** tienen un contraste insuficiente en esos casos. Reservarlos para ilustración, superficies de acento con texto muy oscuro cuando pase contraste, iconos grandes o bordes.
- Estados definidos por tokens distintos: `status.success`, `status.warning`, `status.danger`, `status.info`. El mensaje debe contener **texto, icono o etiqueta** además de color.
- **Foco de teclado:** anillo visible; no sustituir por sombra sutil. Mantener AA WCAG como mínimo: texto normal ≥4.5:1, texto grande ≥3:1 y límites importantes de componentes no textuales ≥3:1.
- No codificar significado clínico/sanitario con la paleta decorativa. Un lote bloqueado necesita mensaje explícito y acción adecuada, no simplemente un color terracota.

### 4.3. Proporciones sugeridas

**Landing:** papel 45–65%, blanco/superficies 20–35%, verde 10–20%, acentos combinados ≤10%. **App operativa:** superficie clara y texto dominan; acentos ilustrativos mínimos. Estas proporciones son orientativas, no restricción de implementación.

## 5. Tipografía

**Familia editorial:** `Fraunces` para H1, H2, citas y títulos de relato. Usar ejes/pesos legibles; evitar decoraciones extremas y usar cursiva de forma puntual.

**Familia de interfaz:** `Inter` en párrafos, botones, menú, inputs, tablas, etiquetas y cifras. `Source Sans 3` es fallback/alternativa de proyecto **solo mediante decisión global**, nunca simultánea con Inter en pantallas distintas.

| Escala | Uso | Tamaño sugerido | Interlineado |
|---|---|---|---|
| `display` | Hero público | `clamp(2.65rem, 5vw, 4.5rem)` | 1.05 |
| `h1` | Título de sección principal | `clamp(2rem, 3.5vw, 3rem)` | 1.12 |
| `h2` | Título de módulo/área | `clamp(1.5rem, 2.3vw, 2rem)` | 1.2 |
| `h3` | Títulos de tarjeta | `1.25rem` | 1.3 |
| `body` | Párrafo/UI | `1rem` | 1.55 |
| `small` | Ayuda/metadatos | `0.875rem` | 1.45 |
| `caption` | Identificación auxiliar | `0.75rem` | 1.45 |

**Reglas:** un solo H1 por página; máximo dos pesos dominantes por bloque; anchura de lectura en contenido largo de ~65–75 caracteres; números tabulares en tablas y KPIs; evitar serif en controles, cifras densas, formularios y mensajes de error.

## 6. Composición y espaciado

- Escala espacial de base **4 px**, aplicada mediante tokens: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Contenedor público máximo `1160 px`; párrafo editorial máximo `720 px`; en app usar layout funcional, no forzar grandes márgenes editoriales.
- Landing: ritmo de secciones generoso, clara separación temática, una acción principal por contexto.
- App: densidad moderada, acceso inmediato a la operación principal, filtros próximos a tablas/gráficos y jerarquía estable.
- Radios: controles 10 px, tarjetas 16 px; uso de cápsula solo en chips. No redondear absolutamente todo.
- Sombras bajas, bordes finos y contraste de superficie. Evitar gradientes fuertes, glassmorphism y tarjetas flotantes por defecto.
- **Responsivo:** diseñar primero 360–390 px, probar 320 px, 768 px, 1024 px y ≥1440 px. Nunca ocultar información crítica únicamente por falta de ancho; apilar o permitir scroll controlado donde corresponda.

## 7. Ilustraciones y recursos gráficos

### 7.1. Familia ilustrada de seis especies

Pollos de engorde, gallinas ponedoras, codornices, patos, conejos y cuyes. La serie debe compartir:

- Trazo orgánico de grosor coherente, con referencias a grabados y guías naturalistas.
- Siluetas y anatomía **reconocibles**; expresividad sin ojos sobredimensionados ni rasgos antropomórficos infantiles.
- Paleta restringida a bosque, grafito, ocre, terracota, papel y variantes tonales verificadas.
- Textura suave (grabado/trama), nunca ruido digital excesivo.
- Espacios de respiro para integrarse con títulos y productos reales.
- Máster SVG editable con viewBox consistente; exportaciones WebP/PNG optimizadas según contexto; textos accesibles `alt` según función.

**Dos niveles de uso:** ilustración hero/pieza narrativa (más rica) e icono/silueta pequeño por especie (muy simplificado). No reducir sin adaptación la misma ilustración compleja a 20 px.

### 7.2. Señalética agroindustrial

Usar marcadores `01 / 02 / 03`, fichas de lote, fechas, líneas de cotas y pequeñas anotaciones técnicas como acentos. **Nunca imitar un sello oficial o una certificación que no exista.** No crear diplomas, insignias sanitarias o datos de productividad de demostración que parezcan verificados.

### 7.3. Fotografía

Preferir fotografías propias y auténticas de trabajo en finca; luz natural, condiciones reales y dignidad de las personas retratadas. Evitar imágenes de banco excesivamente idealizadas, estampas genéricas del campo y fotos de animales usadas como sustitutos de evidencia de la app.

## 8. Iconografía y datos

- **Iconos de UI:** una sola familia de trazos uniforme (p. ej. Lucide); 20–24 px habituales, grosor consistente.
- **Iconos de especie:** sistema ilustrativo propio, no mezclar con emojis como iconografía oficial.
- **Gráficos:** etiquetas y unidades visibles, ejes comprensibles, leyenda y texto alternativo/resumen; usar series con patrones/formas además de color cuando haga falta; nunca emplear terracota solo para indicar error si también es acento decorativo.
- **KPIs:** valores reales o rotulados como ficticios; mostrar período, unidad, estado de sincronización y definición cuando corresponda.

## 9. Biblioteca de componentes obligatoria

Todos los componentes tienen que especificar: `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error` cuando aplique, variante móvil y comportamiento offline si capturan datos.

| Componente | Reglas mínimas |
|---|---|
| **Button** | Primario verde + texto blanco; secundario borde verde; terciario texto/ícono. Etiquetas con verbo; mínimo táctil 48 px en campo. |
| **Link** | Siempre distinguible de texto corriente sin depender únicamente del color; foco visible. |
| **Input / Select / Textarea** | Etiqueta persistente; ejemplo/ayuda fuera del placeholder; estado de error con explicación. |
| **Checkbox / Radio / Switch** | Área táctil amplia; estados accesibles, no inventar variantes por formulario. |
| **Card** | Superficie blanca; borde sobrio; sin elementos decorativos que compitan con el contenido. |
| **Alert / Toast** | Success/warning/danger/info por token semántico, icono + título + instrucción. |
| **Badge / Chip** | Para estado o filtros, no para decorar encabezados; contraste revisado. |
| **Nav / Tabs / Breadcrumb** | Ubicación y orden estables; estado activo inequívoco. |
| **Table / Data grid** | Inter, cifras tabulares, títulos de columna claros; densidad de app y opción responsive. |
| **Modal / Drawer** | Cerrar/guardar claros; evitar bloquear tareas de campo por detalles menores. |
| **Empty state** | Ilustración pequeña opcional, explica qué falta y ofrece una acción concreta. |
| **Offline / Sync indicator** | Mensajes explícitos: guardado local, pendiente de sincronizar, sincronizado, conflicto. Jamás indicar “sincronizado” hasta confirmación real. |

### Microcopy de interfaz

Tono directo y cercano: **«Registra los huevos de hoy»**, **«Quedan 4 días de alimento»**, **«Guardado en este dispositivo»**. Evitar exceso de jerga (`M&E`, `FCR`, `offline-first`) en niveles básicos: presentar término simple y una explicación cuando sea necesario.

### Componentes pedagógicos

Las viñetas o recursos tipo cómic se reservan para tutoriales cortos, explicaciones de ahorro, preparación de equipos o vacíos de datos. **No** se colocan junto a alarmas sanitarias graves, pérdidas, mortalidad o decisiones de seguridad como tono humorístico.

## 10. Patrones por superficie

### Landing y comercial

1. Hero: una promesa clara + una CTA principal + una secundaria.
2. Cómo funciona: hasta tres pasos con ilustración editorial.
3. Qué resuelve: bloques de beneficios comprensibles con evidencia de pantalla real.
4. Confianza: usos verificados, casos reales con permiso, especificaciones verificables.
5. CTA final: comenzar o solicitar asesoría según segmento.

**Productores primero**, con camino separado y visible para cooperativas, ONGs, técnicos e instituciones. No convertir la portada en un catálogo exhaustivo de normas, tablas biológicas y arquitectura técnica.

### App de campo

- Prioridad 1: tarea diaria, registro rápido y confirmación de guardado.
- Prioridad 2: estado productivo y financiero legible.
- Prioridad 3: historial, configuración y análisis profundo.
- Etiquetas de acciones concretas; pantallas sencillas, progresión de complejidad; mantener botones ≥48 × 48 px en flujos de galpón.
- Mostrar el estado local/sincronización en los puntos de guardado que lo ameriten.

### Torre de control / vista institucional

- Más densidad de datos y menor ocupación ilustrativa.
- Estado de alertas claro, filtros coherentes, datos desagregados y contexto temporal.
- No usar indicadores tipo semáforo como única señal; acompañarlos con etiqueta de severidad y criterio.

### Documentación y material físico

- Portadas con Fraunces + papel/verde; cuerpo y tablas con Inter.
- Guías de campo imprimibles con alto contraste; textura y fondos pesados solo cuando no afecten impresión.
- QR con márgenes de seguridad y prueba de lectura sobre soporte real; no ornamentar el código.

## 11. Accesibilidad, rendimiento y operación

- WCAG **2.2 AA** como objetivo de diseño y prueba, no certificación automática.
- Texto normal mínimo 16 px en flujos críticos salvo metadatos auxiliares muy puntuales.
- Botones y campos táctiles ≥48 px para operación con guantes/sol; navegación por teclado y lector de pantalla funcionales.
- Animaciones sutiles, 120–200 ms en transiciones comunes; respetar `prefers-reduced-motion`.
- Ilustraciones lazy-loaded cuando no sean el contenido principal; SVG optimizados; evitar fuentes y texturas que ralenticen redes rurales.
- No depender de una solicitud a servidor para explicar si el guardado offline fue exitoso; comunicar el estado real del dato.
- Validar navegación y contraste en dispositivos de gama baja o con brillo alto siempre que sea posible.

## 12. Gobernanza del diseño

### Autoridad de decisiones

1. `tokens/tokens.json` define **valores visuales canónicos**.
2. Biblioteca compartida (`Button`, `Input`, `Card`, etc.) implementa los patrones.
3. Esta guía regula semántica, tono, composición y uso.
4. El skill regula el procedimiento de los agentes.
5. Las páginas **consumen** componentes y tokens; no crean estilos globales propios.

### Cambio propuesto

**Registrar** → **evaluar reutilización** → **editar tokens/componente** → **probar estados y responsive** → **actualizar muestra/documentación** → **revisar** → **desplegar**.

Una excepción local debe registrar motivo, propietario y fecha para revisión. Prohibido clonar CSS para “arreglar rápido” una página si el patrón es reutilizable.

### Plan de armonización

**Etapa A — inventario:** capturas de páginas actuales, colores reales, fonts, botones, spacing, navegación, ilustraciones y estados. Marcar divergencias.

**Etapa B — base:** cargar tokens y fuentes, crear/reconciliar componentes canónicos y tema global. Corregir primero navegación, formularios y botones.

**Etapa C — migración:** landing → onboarding → tareas de campo → dashboard → reportes/documentación (ajustar orden por uso y riesgo).

**Etapa D — control:** QA visual por PR, capturas comparables (360/768/1440), revisión de contraste y prueba de tarea en móvil.

### Métricas de coherencia

- % de pantallas sin colores HEX locales.
- % de botones y formularios usando la biblioteca compartida.
- # de variantes visuales fuera del catálogo.
- % de pantallas validadas a 360 px y con foco visible.
- Tiempo/errores de una tarea principal de campo, antes y después.

## 13. Antipatrones expresamente prohibidos

- Verde diferente en cada pantalla; terracota como error y decoración sin distinción.
- Tres fuentes en una misma página o serif en formularios y tablas.
- Hero repleto de chips, KPIs, seis CTAs y textos técnicos.
- Card dentro de card dentro de card; sombras enormes, gradientes brillantes y glassmorphism.
- Ilustraciones infantiles, emojis oficiales o cómic humorístico en alertas graves.
- Componente nuevo cuando ya hay equivalente del sistema.
- Fotografías genéricas como prueba de funcionalidades; cifras no verificadas.
- Señales de éxito/sincronización sin estado validado.
- Usar una textura de papel tan fuerte que reduzca la lectura.

## 14. Decisiones pendientes de validar con el producto

1. Inventario de pantallas, componentes y tecnologías efectivamente usadas en `app.iwage.co` y `gallinero.iwage.co`.
2. Logotipo oficial vigente de **IwaGranja** (horizontal con eslogan y cuadrado sin eslogan) integrado con el ecosistema Iwagé.
3. Primer set definitivo de ilustraciones (6 especies) y licencias de uso.
4. Adaptador concreto del stack (CSS nativo, Tailwind, tokens de componentes, etc.).
5. Prueba del sistema con 3 perfiles: pequeño productor, técnico/extensionista, coordinador institucional.

**Criterio de aprobación:** una persona debe identificar que dos pantallas pertenecen a IwaGranja aun si una es una landing ilustrada y otra es un registro de alimento sin imágenes.
