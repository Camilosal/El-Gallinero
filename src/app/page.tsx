import Link from "next/link";
import Image from "next/image";
import ScrollReveal from "@/components/ScrollReveal";
import MobileNav from "@/components/MobileNav";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://iwage.co/granja/gallinero#webpage",
      url: "https://iwage.co/granja/gallinero",
      name: "El Gallinero — Iwagé Granja",
      description:
        "Software abierto que gestiona la parvada real de Iwagé Granja en la vereda Ambalá: identidad individual por ave, trazabilidad financiera automática y modo simple/avanzado para el registro diario.",
      inLanguage: "es-CO",
      isPartOf: { "@id": "https://iwage.co#website" },
      about: { "@id": "https://iwage.co/granja/gallinero#software" },
      breadcrumb: { "@id": "https://iwage.co/granja/gallinero#breadcrumb" },
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://iwage.co/granja/gallinero#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Iwagé", item: "https://iwage.co" },
        { "@type": "ListItem", position: 2, name: "Granja", item: "https://iwage.co/granja" },
        { "@type": "ListItem", position: 3, name: "El Gallinero", item: "https://iwage.co/granja/gallinero" },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://iwage.co/granja/gallinero#software",
      name: "El Gallinero",
      description:
        "Sistema de gestión avícola de código abierto: identidad individual por ave, trazabilidad financiera automática (PEPS por talla de huevo), sanidad, inventarios y modo simple/avanzado. En producción real en Iwagé Granja, Ambalá, Colombia.",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Farm Management Software",
      operatingSystem: "Web, PWA",
      softwareRequirements: "Navegador web moderno",
      programmingLanguage: ["TypeScript", "React"],
      codeRepository: "https://github.com/Camilosal/El-Gallinero",
      license: "https://github.com/Camilosal/El-Gallinero/blob/main/LICENSE",
      url: "https://iwage.co/granja/gallinero",
      sameAs: ["https://github.com/Camilosal/El-Gallinero"],
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      creator: { "@id": "https://iwage.co#organization" },
      isPartOf: { "@id": "https://iwage.co/granja#project" },
    },
    {
      "@type": "Organization",
      "@id": "https://iwage.co#organization",
      name: "Iwagé",
      url: "https://iwage.co",
      description:
        "Granja autosustentable y meliponario en la vereda Ambalá, Ibagué, Tolima, Colombia.",
    },
  ],
};

export default function LandingPage() {
  return (
    <ScrollReveal>
      <div style={{ background: "var(--cream)", color: "var(--ink)", fontFamily: "var(--font-inter, 'Inter'), sans-serif", lineHeight: 1.6, WebkitFontSmoothing: "antialiased" }}>
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* ── NAV ── */}
        <nav className="land-nav">
          <div className="land-wrap">
            <div className="land-brandmark">
              <span className="dot" />
              El Gallinero <small>&nbsp;· IWAGÉ GRANJA</small>
            </div>
            <div className="land-navlinks">
              <a href="#historia">Historia</a>
              <a href="#funcionalidades">Funcionalidades</a>
              <a href="#caminos">Probarlo</a>
              <a href="#cierre">Sobre el criterio</a>
            </div>
            <MobileNav />
          </div>
        </nav>

        {/* ── HERO ── */}
        <header className="land-hero">
          <div className="land-wrap land-hero-grid">
            <div>
              <div className="land-eyebrow">
                Agroecosistema productivo — producción animal integrada
              </div>
              <h1 className="land-h1">
                Un gallinero real,
                <br />
                trazado <em>día a día</em>.
              </h1>
              <p className="lede">
                Software abierto que gestiona la parvada de la granja de Ambalá
                desde 2026 — cada ave, cada huevo y cada peso, con trazabilidad
                completa. No es una demo: es la herramienta con la que se lleva
                el gallinero.
              </p>
              <div className="land-cta-row">
                <Link href="/login" className="land-btn land-btn-primary">
                  Ingresar a la app →
                </Link>
                <a
                  href="https://github.com/Camilosal/El-Gallinero"
                  className="land-btn land-btn-ghost"
                >
                  Ver el código en GitHub
                </a>
              </div>
            </div>

            <div className="land-logcard">
              <div className="stamp">HOY EN EL GALLINERO</div>
              <h3>Bitácora — corredor Ambalá</h3>
              <div className="land-logrow">
                <div className="land-logstat">
                  <div className="n">26</div>
                  <div className="l">gallinas activas</div>
                </div>
                <div className="land-logstat">
                  <div className="n">13</div>
                  <div className="l">huevos / día (prom.)</div>
                </div>
                <div className="land-logstat">
                  <div className="n">28d</div>
                  <div className="l">stock de alimento</div>
                </div>
                <div className="land-logstat">
                  <div className="n">7</div>
                  <div className="l">módulos conectados</div>
                </div>
              </div>
              <div className="land-logfoot">
                <span>fuente: el-gallinero, prod.</span>
                <span>PEPS · trazabilidad automática</span>
              </div>
            </div>
          </div>

          <div className="land-wrap">
            <div className="land-microstrip land-reveal">
              <span>
                <strong>7</strong> módulos conectados
              </span>
              <span className="sep">·</span>
              <span>Auto-registro financiero</span>
              <span className="sep">·</span>
              <span>Funciona sin conexión (PWA)</span>
              <span className="sep">·</span>
              <span>Código abierto — MIT</span>
            </div>
          </div>

          {/* Hero illustration */}
          <div className="land-wrap land-hero-illust land-reveal">
            <Image
              src="/hero-illustration.png"
              alt="Ilustración del gallinero de Ambalá con gallinas de diferentes razas en el corredor"
              width={1080}
              height={810}
              style={{ objectFit: "cover" }}
            />
          </div>
        </header>

        {/* ── HISTORIA ── */}
        <section className="land-section land-historia" id="historia">
          <div className="land-wrap">
            <div className="land-eyebrow">Por qué existe</div>
            <h2 className="land-h2 land-reveal">
              Nació de una pregunta operativa, no de una idea de producto.
            </h2>
            <div className="land-historia-grid">
              <p className="land-pull land-reveal">
                «¿Cuánto cuesta realmente una docena de huevos en Ambalá — y
                cuánto se gana vendiéndola?»
              </p>
              <div className="land-factline-list">
                <div className="land-factline land-reveal">
                  <span className="k">Identidad</span>
                  <span className="v">
                    Cada gallina con raza, edad y etapa — no un número en un
                    lote.
                  </span>
                </div>
                <div className="land-factline land-reveal">
                  <span className="k">Trazabilidad</span>
                  <span className="v">
                    Cada huevo rastreable hasta su venta.
                  </span>
                </div>
                <div className="land-factline land-reveal">
                  <span className="k">Costo real</span>
                  <span className="v">
                    Cada peso de alimento o vacuna, conectado al evento que lo
                    generó.
                  </span>
                </div>
                <div className="land-factline end land-reveal">
                  <span className="k">Hoy</span>
                  <span className="v">
                    26 aves activas, trazabilidad financiera automática, cero
                    cuaderno.
                  </span>
                </div>
              </div>
            </div>

            {/* Traceability flow illustration */}
            <div className="land-trace-illust land-reveal">
              <Image
                src="/traceability-flow.png"
                alt="Diagrama de trazabilidad: gallina pone huevo, se clasifica por tamaño, y se genera transacción financiera automática"
                width={1080}
                height={617}
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>
        </section>

        {/* ── FUNCIONALIDADES ── */}
        <section className="land-section land-func" id="funcionalidades">
          <div className="land-wrap">
            <div className="land-func-head">
              <div className="land-eyebrow">Qué hace El Gallinero</div>
              <h2 className="land-h2 land-reveal">
                Siete módulos que cubren todo lo que pasa en el gallinero.
              </h2>
              <p className="land-reveal">
                Cada módulo se conecta automáticamente con el financiero: no hay
                que registrar dos veces lo mismo. Lo que operas se traza, se
                cuenta y se reporta solo.
              </p>
            </div>

            <div className="land-func-grid">
              <div className="land-func-card land-reveal">
                <div className="ficon">🐔</div>
                <h3>Producción</h3>
                <p>
                  Parvada individual con código, raza, edad y etapa. Ciclo de
                  vida automático de 8 estados. Lotes de engorde, incubación,
                  sacrificios y mortalidad con trazabilidad completa.
                </p>
                <div className="ftags">
                  <span className="ftag">gallinas</span>
                  <span className="ftag">pollos</span>
                  <span className="ftag">incubación</span>
                  <span className="ftag">mortalidad</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon">🥚</div>
                <h3>Inventarios</h3>
                <p>
                  Huevos con PEPS por talla y alerta de envejecimiento. Stock de
                  aves, insumos y gallinaza. Balance consolidado con valor total
                  del inventario en tiempo real.
                </p>
                <div className="ftags">
                  <span className="ftag">huevos PEPS</span>
                  <span className="ftag">aves</span>
                  <span className="ftag">insumos</span>
                  <span className="ftag">gallinaza</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon">💊</div>
                <h3>Sanidad</h3>
                <p>
                  Control sanitario con eventos de vacunación, desparasitación y
                  tratamiento. Calendario preventivo con recordatorios y días de
                  retiro. Trazabilidad por ave o lote.
                </p>
                <div className="ftags">
                  <span className="ftag">vacunas</span>
                  <span className="ftag">calendario</span>
                  <span className="ftag">tratamientos</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon">🔧</div>
                <h3>Operaciones</h3>
                <p>
                  Tareas de mantenimiento con estado, costo y plantillas rápidas.
                  Gallinaza con factores de producción por grupo, ajustes
                  manuales y ventas con ingreso automático.
                </p>
                <div className="ftags">
                  <span className="ftag">mantenimiento</span>
                  <span className="ftag">gallinaza</span>
                  <span className="ftag">tareas</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon">💰</div>
                <h3>Finanzas</h3>
                <p>
                  Cada venta, compra o evento sanitario genera su transacción
                  automática. KPIs, presupuestos, cuentas por cobrar y pagar, y
                  gráficos de evolución financiera.
                </p>
                <div className="ftags">
                  <span className="ftag">ventas</span>
                  <span className="ftag">egresos</span>
                  <span className="ftag">presupuestos</span>
                  <span className="ftag">CxC / CxP</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon">📊</div>
                <h3>Análisis</h3>
                <p>
                  KPIs de productividad, mortalidad, conversión alimenticia y
                  rentabilidad. Reportes exportables por período. Alertas de
                  desviaciones en indicadores clave.
                </p>
                <div className="ftags">
                  <span className="ftag">KPIs</span>
                  <span className="ftag">reportes</span>
                  <span className="ftag">tendencias</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon">⚙️</div>
                <h3>Configuración</h3>
                <p>
                  Catálogos maestros: tamaños de huevo, razas, compradores,
                  proveedores, categorías y unidades de medida. Todo parametrizable
                  sin tocar código.
                </p>
                <div className="ftags">
                  <span className="ftag">catálogos</span>
                  <span className="ftag">razas</span>
                  <span className="ftag">proveedores</span>
                </div>
              </div>
            </div>

            {/* Modules diagram illustration */}
            <div className="land-modules-illust land-reveal">
              <Image
                src="/modules-diagram.png"
                alt="Diagrama de los 7 módulos conectados de El Gallinero: Producción, Inventarios, Sanidad, Operaciones, Finanzas, Análisis y Configuración"
                width={520}
                height={520}
                style={{ objectFit: "contain" }}
              />
            </div>

            {/* ── Manual de usuario banner ── */}
            <div className="land-manual land-reveal">
              <div className="land-manual-text">
                <div className="land-eyebrow">Documentación</div>
                <h3>Manual de usuario</h3>
                <p>
                  Guía paso a paso para configurar tu gallinero, registrar la
                  producción diaria y aprovechar cada módulo. Incluye primeros
                  pasos, flujos operativos y preguntas frecuentes.
                </p>
              </div>
              <Link href="/dashboard/guia" className="land-manual-btn">
                Abrir el manual →
              </Link>
            </div>
          </div>
        </section>

        {/* ── CAMINOS ── */}
        <section className="land-section" id="caminos">
          <div className="land-wrap">
            <div className="land-caminos-head">
              <div className="land-eyebrow">Dos formas de entrar</div>
              <h2 className="land-h2 land-reveal">
                Elige tu camino según lo que necesitas resolver.
              </h2>
            </div>
            <div className="land-paths">
              <div className="land-path land-reveal">
                <div className="tag">Para quien lleva un gallinero</div>
                <h3 className="land-h3">Pruébalo antes de instalar nada</h3>
                <p>
                  La demo pública corre con meses de historial simulado — huevos,
                  ventas, alimento, sanidad — para explorar el sistema completo
                  sin tocar tus propios datos.
                </p>
                <ul>
                  <li>Cada ave con ficha propia: código, raza, edad, etapa</li>
                  <li>Vista de acceso rápido para el registro diario</li>
                  <li>Modo simple y modo avanzado, sin abrumar desde el día uno</li>
                  <li>Cada venta o tratamiento genera su transacción automáticamente</li>
                  <li>Funciona sin conexión — registra en el gallinero aunque no haya señal</li>
                </ul>
                <Link href="/login" className="go">
                  Ingresar a la app →
                </Link>
              </div>
              <div className="land-path land-reveal">
                <div className="tag">Para quien desarrolla o gestiona sistemas</div>
                <h3 className="land-h3">La ficha técnica</h3>
                <p>
                  Software libre publicado en GitHub bajo licencia abierta,
                  pensado para que cualquier gallinero pequeño o mediano lo
                  despliegue con su propia base de datos.
                </p>
                <ul>
                  <li>Next.js 16 + React 19 · Drizzle ORM sobre PostgreSQL · Tailwind CSS 4</li>
                  <li>7 módulos, 25 tablas, reglas de negocio explícitas</li>
                  <li>
                    <code style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace" }}>
                      docker compose up
                    </code>{" "}
                    levanta app y base de datos en un paso
                  </li>
                  <li>README con arquitectura, diccionario de datos y guía de contribución</li>
                </ul>
                <a
                  href="https://github.com/Camilosal/El-Gallinero"
                  className="go"
                >
                  Ver el repositorio →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── CIERRE ── */}
        <section className="land-section land-cierre" id="cierre">
          <div className="land-wrap land-cierre-grid">
            <div>
              <div className="land-eyebrow">El criterio de fondo</div>
              <h2 className="land-h2 land-reveal">
                La misma disciplina que se aplica a cualquier sistema.
              </h2>
              <p className="land-lead-short land-reveal">
                No es un caso aislado. Es evidencia de que el criterio se
                sostiene fuera de una presentación.
              </p>
              <ul className="land-chiplist land-reveal">
                <li>Modelar el proceso real antes que la pantalla</li>
                <li>Conectar cada operación con su impacto financiero</li>
                <li>Trazabilidad completa, sin reportes reconstruidos a mano</li>
              </ul>
            </div>
            <div className="land-cierre-card land-reveal">
              <div className="row">
                <span>Sistema</span>
                <span>Agroecosistema productivo</span>
              </div>
              <div className="row">
                <span>Línea</span>
                <span>Producción animal integrada</span>
              </div>
              <div className="row">
                <span>Territorio</span>
                <span>Vereda Ambalá</span>
              </div>
              <div className="row">
                <span>Licencia</span>
                <span>Código abierto</span>
              </div>
              <div className="row">
                <span>Estado</span>
                <span>En producción</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="land-footer">
          <div className="land-wrap land-foot-grid">
            <div className="eco">
              El Gallinero es parte del sistema Agroecosistema productivo de
              Iwagé Granja, dentro del Ecosistema Iwagé.
            </div>
            <nav className="foot-links">
              <a href="https://iwage.co">iwage.co</a>
              <a href="https://iwage.co/granja">granja/bitácora</a>
              <a href="https://github.com/Camilosal/El-Gallinero">GitHub</a>
            </nav>
          </div>
        </footer>
      </div>
    </ScrollReveal>
  );
}
