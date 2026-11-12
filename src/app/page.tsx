import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Bot,
  CalendarDays,
  CircleDollarSign,
  Egg,
  MapPin,
  Package,
  PawPrint,
  Settings,
  Stethoscope,
  Wheat,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import MobileNav from "@/components/MobileNav";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://gallinero.iwage.co/#webpage",
      url: "https://gallinero.iwage.co/",
      name: "El Gallinero — Iwagé Granja",
      description:
        "Sistema abierto para gestionar aves y pequeños animales con trazabilidad de origen y genética, lugares de manejo georreferenciados, activos y equipos, mantenimiento periódico, producción, sanidad, finanzas y un agente de IA.",
      inLanguage: "es-CO",
      isPartOf: { "@id": "https://iwage.co#website" },
      about: { "@id": "https://gallinero.iwage.co/#software" },
      breadcrumb: { "@id": "https://gallinero.iwage.co/#breadcrumb" },
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://gallinero.iwage.co/#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Iwagé", item: "https://iwage.co" },
        { "@type": "ListItem", position: 2, name: "Granja", item: "https://iwage.co/granja" },
        { "@type": "ListItem", position: 3, name: "El Gallinero", item: "https://gallinero.iwage.co/" },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://gallinero.iwage.co/#software",
      name: "El Gallinero",
      description:
        "Sistema de gestión de producción animal de código abierto: trazabilidad de origen y genética desde la adquisición, manejo multiespecie por lugar, activos y equipos, mantenimiento periódico, control de huevos y carne, sanidad, inventarios valorizados, finanzas, curvas de referencia y un agente de IA para consultas y registros operativos.",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Farm Management Software",
      operatingSystem: "Web, PWA",
      softwareRequirements: "Navegador web moderno",
      programmingLanguage: ["TypeScript", "React"],
      codeRepository: "https://github.com/Camilosal/El-Gallinero",
      license: "https://github.com/Camilosal/El-Gallinero/blob/main/LICENSE",
      url: "https://gallinero.iwage.co/",
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
              <a href="#alcance">El sistema</a>
              <a href="#funcionalidades">Qué puedes gestionar</a>
              <a href="#flujo">Trazabilidad</a>
              <a href="#acceso">Acceso</a>
            </div>
            <MobileNav />
          </div>
        </nav>

        {/* ── HERO ── */}
        <header className="land-hero">
          <div className="land-hero-backdrop" aria-hidden="true">
            <picture>
              <source
                type="image/webp"
                srcSet="/images/heroes/inicio-1x.webp 1x, /images/heroes/inicio-2x.webp 2x"
              />
              <img
                src="/images/heroes/inicio-1x.jpg"
                alt=""
                aria-hidden="true"
                width={1600}
                height={560}
                decoding="async"
                fetchPriority="high"
              />
            </picture>
          </div>
          <div className="land-wrap land-hero-grid relative z-10">
            <div>
              <div className="land-eyebrow">
                Gestión de producción animal · Ambalá, Colombia
              </div>
              <h1 className="land-h1">
                Del ingreso del animal
                <br />
                al resultado <em>de la granja</em>.
              </h1>
              <p className="lede">
                El Gallinero conecta animales, producción, sanidad, inventarios
                y finanzas. Registra gallinas, gallos, pollos, patos,
                codornices y conejos con procedencia, genética y lugar de manejo,
                para seguir cómo evoluciona cada grupo dentro de la finca.
              </p>
              <div className="land-cta-row">
                <Link href="/login" className="land-btn land-btn-primary">
                  Entrar al sistema →
                </Link>
                <a href="#funcionalidades" className="land-btn land-btn-ghost">
                  Conocer el sistema
                </a>
              </div>
            </div>

            <div className="land-logcard">
              <div className="stamp">DEL ORIGEN AL RESULTADO</div>
              <h3>Una ruta conectada para cada registro</h3>
              <div className="land-logrow">
                <div className="land-logstat">
                  <div className="n">01</div>
                  <div className="l">Ingreso y procedencia</div>
                </div>
                <div className="land-logstat">
                  <div className="n">02</div>
                  <div className="l">Ficha individual o lote</div>
                </div>
                <div className="land-logstat">
                  <div className="n">03</div>
                  <div className="l">Salud y producción</div>
                </div>
                <div className="land-logstat">
                  <div className="n">04</div>
                  <div className="l">Inventario y resultado</div>
                </div>
              </div>
              <div className="land-logfoot">
                <span>animales · lotes · especies</span>
                <span>costos · ventas · reportes</span>
              </div>
            </div>
          </div>

          <div className="land-wrap relative z-10">
            <div className="land-microstrip land-reveal">
              <span>
                Animales y producción multiespecie
              </span>
              <span className="sep">·</span>
              <span>Trazabilidad desde adquisiciones</span>
              <span className="sep">·</span>
              <span>Resultados por lugar de manejo</span>
              <span className="sep">·</span>
              <span>Activos, equipos y mantenimiento periódico</span>
              <span className="sep">·</span>
              <span>Agente de IA para consultar y registrar</span>
              <span className="sep">·</span>
              <span>Código abierto · MIT</span>
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

        {/* ── ALCANCE DEL SISTEMA ── */}
        <section className="land-section land-historia" id="alcance">
          <div className="land-wrap">
            <div className="land-eyebrow">El sistema hoy</div>
            <h2 className="land-h2 land-reveal">
              Un mismo registro para animales distintos, con reglas para cada especie.
            </h2>
            <div className="land-historia-grid">
              <p className="land-pull land-reveal">
                «¿De dónde vino cada animal, cómo está, qué produce y cuánto
                cuesta sostenerlo?»
              </p>
              <div className="land-factline-list">
                <div className="land-factline land-reveal">
                  <span className="k">Especies</span>
                  <span className="v">
                    Gallinas y gallos con ficha individual; pollos, patos,
                    codornices y conejos con su especie, raza y tipo de manejo.
                  </span>
                </div>
                <div className="land-factline land-reveal">
                  <span className="k">Procedencia</span>
                  <span className="v">
                    El seguimiento empieza en adquisiciones: origen, línea,
                    generación, progenitores y referencias documentales enlazadas
                    al animal o lote cuando esos datos se conocen.
                  </span>
                </div>
                <div className="land-factline land-reveal">
                  <span className="k">Lugar</span>
                  <span className="v">
                    Cada grupo puede asociarse con un corral, jaula, galpón,
                    potrero, jardín o patio para consultar resultados y condiciones
                    operativas por espacio.
                  </span>
                </div>
                <div className="land-factline land-reveal">
                  <span className="k">Producción</span>
                  <span className="v">
                    Huevos cuando las aves están en etapa productiva; además de
                    pesajes, faena y existencias de carne.
                  </span>
                </div>
                <div className="land-factline end land-reveal">
                  <span className="k">Decisiones</span>
                  <span className="v">
                    Costos, inventarios e indicadores conectados con reportes y
                    curvas de referencia por especie.
                  </span>
                </div>
              </div>
            </div>

            {/* Traceability flow illustration */}
            <div className="land-trace-illust land-reveal" id="flujo">
              <div className="land-eyebrow">Un recorrido trazable</div>
              <p className="land-lead-short">
                Del origen y alojamiento a la producción, el inventario, la
                venta y su efecto financiero.
              </p>
              <Image
                src="/traceability-flow.png"
                alt="Flujo de trazabilidad del huevo: producción, clasificación por tamaño, inventario y venta relacionada con finanzas"
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
                Las áreas de trabajo comparten el mismo origen y los mismos datos.
              </h2>
              <p className="land-reveal">
                Registra una operación y sigue su relación con animales,
                producción, existencias y cuentas. Los indicadores consideran
                especie, etapa y propósito productivo.
              </p>
            </div>

            <div className="land-func-grid">
              <div className="land-func-card land-reveal">
                <div className="ficon"><PawPrint className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Animales y procedencia</h3>
                <p>
                  Registra adquisiciones y cría propia. Gestiona gallinas y
                  gallos por ficha, y otros animales por especie, raza y lote,
                  conservando procedencia, línea genética, progenitores y
                  generación cuando estén disponibles.
                </p>
                <div className="ftags">
                  <span className="ftag">gallinas</span>
                  <span className="ftag">gallos y pollos</span>
                  <span className="ftag">patos · codornices · conejos</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><MapPin className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Lugares e infraestructura</h3>
                <p>
                  Ubica corrales, jaulas, galpones, potreros, jardines o patios.
                  Registra coordenadas, capacidad, condiciones sanitarias y
                  operativas, traslados y necesidades de adecuación. Vincula
                  equipos e infraestructura para mantener su ubicación e historial.
                </p>
                <div className="ftags">
                  <span className="ftag">ficha georreferenciada</span>
                  <span className="ftag">desempeño por lugar</span>
                  <span className="ftag">fichas de equipos</span>
                  <span className="ftag">mantenimiento periódico</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><Egg className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Producción</h3>
                <p>
                  Registra postura cuando las aves están en etapa productiva,
                  además de incubación, pesajes, mortalidad, faena y rendimiento
                  de carne.
                </p>
                <div className="ftags">
                  <span className="ftag">huevos</span>
                  <span className="ftag">incubación</span>
                  <span className="ftag">carne</span>
                  <span className="ftag">mortalidad</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><Package className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Inventarios valorizados</h3>
                <p>
                  Consulta existencias y valor de huevos, carne, animales,
                  alimentos, insumos y gallinaza en sus secciones de inventario.
                </p>
                <div className="ftags">
                  <span className="ftag">huevos</span>
                  <span className="ftag">carne</span>
                  <span className="ftag">animales</span>
                  <span className="ftag">alimentos e insumos</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><Wheat className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Almacén y alimentación</h3>
                <p>
                  Controla entradas, consumo y existencias de alimento; organiza
                  programas por especie y etapa. Administra equipos, garantías,
                  revisiones periódicas e insumos desde la misma área.
                </p>
                <div className="ftags">
                  <span className="ftag">consumo</span>
                  <span className="ftag">programas</span>
                  <span className="ftag">insumos</span>
                  <span className="ftag">mantenimiento</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><CircleDollarSign className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Finanzas</h3>
                <p>
                  Relaciona ventas, compras y movimientos con sus registros de
                  origen. Consulta ingresos, egresos, presupuestos, cuentas y
                  evolución financiera.
                </p>
                <div className="ftags">
                  <span className="ftag">ventas</span>
                  <span className="ftag">egresos</span>
                  <span className="ftag">presupuestos</span>
                  <span className="ftag">CxC / CxP</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><Bot className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Agente de IA</h3>
                <p>
                  Desde el botón Asistente, consulta animales, lotes, producción,
                  lugares, linaje, mantenimiento, inventarios, sanidad y finanzas
                  en lenguaje natural. Puede registrar huevos, mortalidad,
                  pesajes, consumo de alimento y autoconsumo; también consulta
                  equipos y mantenimientos. Las ventas, gastos e ingresos esperan
                  tu confirmación.
                </p>
                <div className="ftags">
                  <span className="ftag">consultas en lenguaje natural</span>
                  <span className="ftag">lugares y linaje</span>
                  <span className="ftag">registros operativos</span>
                  <span className="ftag">confirmación financiera</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><Stethoscope className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Sanidad</h3>
                <p>
                  Registra mortalidad, vacunación, desparasitación y
                  tratamientos. Programa controles y revisa alertas en animales
                  o lotes.
                </p>
                <div className="ftags">
                  <span className="ftag">controles</span>
                  <span className="ftag">calendario</span>
                  <span className="ftag">alertas</span>
                  <span className="ftag">tratamientos</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><BarChart3 className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Análisis y estándares</h3>
                <p>
                  Compara postura y crecimiento con curvas de referencia por
                  especie. Revisa KPIs y reportes para detectar diferencias de
                  desempeño.
                </p>
                <div className="ftags">
                  <span className="ftag">postura</span>
                  <span className="ftag">crecimiento</span>
                  <span className="ftag">costo por huevo y kg de carne</span>
                  <span className="ftag">reportes</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><CalendarDays className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Planeación</h3>
                <p>
                  Proyecta la parvada y organiza el autoconsumo y la producción
                  de la granja con información de su operación.
                </p>
                <div className="ftags">
                  <span className="ftag">plan de parvada</span>
                  <span className="ftag">autoconsumo</span>
                  <span className="ftag">proyecciones</span>
                </div>
              </div>

              <div className="land-func-card land-reveal">
                <div className="ficon"><Settings className="w-5 h-5 text-[var(--forest-deep)]" aria-hidden="true" /></div>
                <h3>Catálogos y configuración</h3>
                <p>
                  Organiza razas y especies asociadas, etapas, vacunas,
                  alimentación y otros datos maestros que usan los formularios
                  y los cálculos.
                </p>
                <div className="ftags">
                  <span className="ftag">especies y razas</span>
                  <span className="ftag">etapas</span>
                  <span className="ftag">vacunas</span>
                  <span className="ftag">parámetros</span>
                </div>
              </div>
            </div>

            <div className="mt-12" aria-labelledby="land-flow-heading">
              <div className="land-eyebrow">La información conserva su relación</div>
              <h3 id="land-flow-heading" className="land-h3 mt-2 text-2xl">
                De la entrada al análisis
              </h3>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["01", "Registrar", "Origen, especie y propósito"],
                  ["02", "Acompañar", "Peso, alimentación y sanidad"],
                  ["03", "Producir", "Huevos, carne y gallinaza"],
                  ["04", "Decidir", "Inventario, costos e indicadores"],
                ].map(([number, title, description]) => (
                  <div key={number} className="rounded-xl border border-[var(--line)] bg-[var(--cream)] p-5">
                    <div className="font-mono text-xs tracking-widest text-[var(--amber-deep)]">{number}</div>
                    <h4 className="mt-2 font-semibold text-[var(--forest-deep)]">{title}</h4>
                    <p className="mt-1 text-sm text-[var(--moss)]">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Manual de usuario banner ── */}
            <div className="land-manual land-reveal">
              <div className="land-manual-text">
                <div className="land-eyebrow">Documentación</div>
                <h3>Una operación que cabe en la rutina diaria</h3>
                <p>
                  Para la persona que lleva la finca: registra primero lugares y
                  procedencia, acompaña sanidad y producción durante el recorrido,
                  y revisa pendientes e indicadores al cierre.
                </p>
              </div>
              <a
                href="/guia"
                target="_blank"
                rel="noopener noreferrer"
                className="land-manual-btn"
              >
                Abrir el manual ↗
              </a>
            </div>
          </div>
        </section>

        {/* ── ACCESO ── */}
        <section className="land-section" id="acceso">
          <div className="land-wrap">
            <div className="land-caminos-head">
              <div className="land-eyebrow">Acceso y proyecto abierto</div>
              <h2 className="land-h2 land-reveal">
                Para operar la granja o adaptar el sistema a otra.
              </h2>
            </div>
            <div className="land-paths">
              <div className="land-path land-reveal">
                <div className="tag">Para la gestión diaria</div>
                <h3 className="land-h3">Entra al sistema de la granja</h3>
                <p>
                  Accede al panel operativo para registrar movimientos y
                  consultar animales, producción, inventarios, tareas e
                  indicadores.
                </p>
                <ul>
                  <li>Conserva el origen de cada animal desde su adquisición</li>
                  <li>Consulta salud, producción y mantenimiento por lugar</li>
                  <li>Usa fichas o lotes según la especie y su manejo</li>
                  <li>Controla postura, carne, alimento, sanidad y costos</li>
                  <li>Compara crecimiento y postura con referencias por especie</li>
                </ul>
                <Link href="/login" className="go">
                  Entrar a El Gallinero →
                </Link>
              </div>
              <div className="land-path land-reveal">
                <div className="tag">Para quien desarrolla o adapta software</div>
                <h3 className="land-h3">Explora el proyecto abierto</h3>
                <p>
                  El código está publicado bajo licencia MIT y puede adaptarse
                  a las necesidades de otros proyectos de producción animal.
                </p>
                <ul>
                  <li>Next.js y React para la aplicación web</li>
                  <li>PostgreSQL y Drizzle ORM para los datos y sus relaciones</li>
                  <li>Reglas de negocio para producción, inventarios y finanzas</li>
                  <li>Repositorio con documentación técnica y guía de instalación</li>
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
              <div className="land-eyebrow">El propósito</div>
              <h2 className="land-h2 land-reveal">
                Cada decisión parte de un dato que se puede seguir.
              </h2>
              <p className="land-lead-short land-reveal">
                El sistema ayuda a explicar el origen, el estado y el destino de
                los animales y de lo que produce la granja.
              </p>
              <ul className="land-chiplist land-reveal">
                <li>Registrar procedencia antes de iniciar el seguimiento</li>
                <li>Relacionar producción, existencias y movimientos financieros</li>
                <li>Comparar el desempeño con referencias de cada especie</li>
              </ul>
            </div>
            <div className="land-cierre-card land-reveal">
              <div className="row">
                <span>Animales</span>
                <span>Aves y especies menores</span>
              </div>
              <div className="row">
                <span>Seguimiento</span>
                <span>Origen, salud y producción</span>
              </div>
              <div className="row">
                <span>Control</span>
                <span>Inventario y finanzas</span>
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
