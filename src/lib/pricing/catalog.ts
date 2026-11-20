import {
  FEATURE_FLAG_CATALOG,
  PROGRESSIVE_ROUTE_GATES,
  PROGRESSIVE_UNLOCKABLE_KEYS,
} from "@/lib/onboarding";
import { RESPONSE_TIME } from "@/lib/legal";
import type {
  PricingCatalog,
  PricingCatalogBenefit,
  PricingCatalogCategoryKey,
  PublicPricingOffer,
} from "./types";

type PublicOfferData = Omit<PublicPricingOffer, "catalog">;

function isReservationsCheckoutConfigured(): boolean {
  const environment = process.env.WOMPI_ENVIRONMENT?.trim().toLowerCase();
  const environmentMatchesApp = process.env.NODE_ENV === "production"
    ? environment === "production"
    : environment === "sandbox";
  const hasServerCredentials = Boolean(
    process.env.RESERVAS_PAYMENT_INTENTS_URL?.trim() &&
    process.env.RESERVAS_PAYMENT_API_SECRET?.trim() &&
    process.env.RESERVAS_PAYMENT_RESULT_SECRET?.trim(),
  );
  try {
    const url = new URL(process.env.RESERVAS_PAYMENT_INTENTS_URL?.trim() || "");
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    const secureTransport = url.protocol === "https:" || (process.env.NODE_ENV !== "production" && localHttp);
    return Boolean(hasServerCredentials && environmentMatchesApp && secureTransport && !url.username && !url.password);
  } catch {
    return false;
  }
}

const CATEGORIES: PricingCatalog["categories"] = [
  { id: "functionalities", label: "Funcionalidades", description: "Herramientas de gestión y opciones disponibles para cada persona." },
  { id: "gina", label: "Gina", description: "Asistente para resolver consultas y apoyar el trabajo diario." },
  { id: "qr", label: "Materiales QR", description: "Identificadores digitales, placas físicas, kit y logística." },
  { id: "training", label: "Formación", description: "Portal autoguiado, horas incluidas y paquetes adicionales." },
  { id: "accompaniment", label: "Acompañamiento", description: "Servicios incluidos y coordinación fuera de la aplicación." },
  { id: "support", label: "Soporte", description: "Canales disponibles y alcance de respuesta." },
  { id: "conditions", label: "Condiciones", description: "Prepago, renovación, impuestos y estado de la contratación." },
];

function availability(
  state: PricingCatalogBenefit["availability"]["state"],
  label: string,
  detail: string,
  routes: string[] = [],
  featureFlag?: string,
): PricingCatalogBenefit["availability"] {
  return { state, label, detail, routes, ...(featureFlag ? { featureFlag } : {}) };
}

function benefit(
  item: Omit<PricingCatalogBenefit, "coverage"> & { coverage: PricingCatalogBenefit["coverage"] },
): PricingCatalogBenefit {
  return item;
}

function progressiveFeatureBenefits(): PricingCatalogBenefit[] {
  const progressiveFlags = new Set<string>(PROGRESSIVE_UNLOCKABLE_KEYS);
  return FEATURE_FLAG_CATALOG.filter((item) => progressiveFlags.has(item.key)).map((item) => {
    const actualGateRoutes = PROGRESSIVE_ROUTE_GATES
      .filter((gate) => gate.flag === item.key)
      .map((gate) => gate.prefix);
    const category: PricingCatalogCategoryKey = "functionalities";
    const configDefault = item.defaultPequeno
      ? "Disponible por defecto para granjas pequeñas."
      : "No se incluye por defecto para granjas pequeñas.";
    const mediumDefault = item.defaultMediano
      ? "Disponible por defecto para granjas medianas."
      : "No se incluye por defecto para granjas medianas.";

    return benefit({
      id: item.key,
      category,
      name: item.name,
      description: item.description,
      unit: "Módulo de la aplicación",
      coverage: {
        free: {
          summary: "Herramientas de gestión incluidas; cada persona ve las opciones correspondientes a su función.",
          limits: [configDefault, mediumDefault],
          frequency: "Mientras esté disponible para tu granja",
        },
        producer: {
          summary: "Herramientas de gestión incluidas; cada persona ve las opciones correspondientes a su función.",
          limits: [configDefault, mediumDefault],
          frequency: "Mientras esté disponible para tu granja",
        },
        aggregator: {
          summary: "Herramientas de gestión para el equipo; cada persona ve las opciones correspondientes a su función.",
          limits: [configDefault, mediumDefault],
          frequency: "Mientras esté disponible para tu granja",
        },
      },
      exclusions: ["Las opciones visibles pueden variar según la función asignada a cada persona."],
      addOns: ["Consulta con el equipo si necesitas ampliar las opciones disponibles en tu granja."],
      availability: availability(
        actualGateRoutes.length > 0 ? "progressive" : "policy_only",
        actualGateRoutes.length > 0 ? "Disponible según el perfil de tu granja" : "Consulta la disponibilidad",
        actualGateRoutes.length > 0
          ? "Las opciones disponibles dependen del perfil de la granja y de la función asignada a cada persona."
          : "El equipo puede orientarte sobre la disponibilidad de esta función para tu granja.",
        actualGateRoutes,
        item.key,
      ),
    });
  });
}

export function buildPublicPricingCatalog(offer: PublicOfferData): PricingCatalog {
  const taxPolicyAllowsCheckout = !offer.taxPolicy.ivaCharged && offer.taxPolicy.amountCop === 0;
  const reservationsCheckoutConfigured = isReservationsCheckoutConfigured() && taxPolicyAllowsCheckout;
  const monthlyGinaFree = `${offer.free.gina.queriesPerUser} consultas, ${offer.free.gina.audiosPerUser} audios y ${offer.free.gina.attachmentsPerUser} adjuntos por usuario/mes`;
  const monthlyGinaPaid = `${offer.producer.gina.queriesPerUser} consultas, ${offer.producer.gina.audiosPerUser} audios y ${offer.producer.gina.attachmentsPerUser} adjuntos por usuario/mes`;
  const freeMax = `${offer.free.users} usuario, ${offer.free.locations} localización y hasta ${offer.free.activeBatchesPerSpecies} lote activo por especie, según política v2.3`;
  const producerKitLimit = offer.producer.locationBands
    .map((band) => `${band.minUsers}–${band.maxUsers} usuarios: hasta ${band.maxLocations} ${band.maxLocations === 1 ? "localización" : "localizaciones"}`)
    .join("; ");
  const progressiveItems = progressiveFeatureBenefits();

  const benefits: PricingCatalogBenefit[] = [
    benefit({
      id: "farm-operations",
      category: "functionalities",
      name: "Gestión de la granja",
      description: "Registro de animales, producción, alimento, sanidad, movimientos, inventarios, ventas y finanzas. Los roles controlan el acceso a los módulos; el plan define cupos y límites de uso.",
      unit: "Por granja / unidad productiva",
      coverage: {
        free: { summary: "Módulos de granja incluidos; acceso a módulos según rol", limits: [freeMax], frequency: "Durante el acceso gratuito" },
        producer: { summary: "Módulos de granja incluidos; acceso a módulos según rol", limits: [`Hasta ${offer.producer.maxUsers} usuarios nominales, sujeto a las plazas contratadas`], frequency: "Durante el período contratado" },
        aggregator: { summary: "Herramientas de gestión para el grupo, según las funciones de cada persona", limits: [`Desde ${offer.aggregator.minPaidBeneficiaries} beneficiarios pagos`], frequency: "Durante el período contratado" },
      },
      exclusions: ["El plan controla cupos y límites de uso; cambiar de plan no modifica los roles asignados.", "El cálculo no activa una suscripción ni cambia los roles o cupos vigentes de la cuenta."],
      addOns: ["Las ampliaciones institucionales se revisan con el equipo."],
      availability: availability("operational", "Herramientas de gestión incluidas", "El plan incluye las herramientas de gestión de la granja. Cada persona accede a las opciones acordes a la función que tiene asignada.", ["/inicio", "/produccion", "/animales", "/almacen", "/sanidad", "/finanzas"]),
    }),
    ...progressiveItems,
    benefit({
      id: "tower-control-me",
      category: "functionalities",
      name: "Torre de Control y reportes M&E de cohorte",
      description: "Vista institucional multipredio y reportes estándar de monitoreo y evaluación para una cohorte de beneficiarios.",
      unit: "Por organización / cohorte",
      coverage: {
        free: { summary: "No incluido", limits: [], frequency: "No aplica" },
        producer: { summary: "No incluido", limits: [], frequency: "No aplica" },
        aggregator: { summary: "Se define de acuerdo con las necesidades de cada proyecto", limits: ["El alcance se acuerda con la organización"], frequency: "Según el proyecto" },
      },
      exclusions: ["No forma parte de la oferta estándar para una cuenta individual."],
      addOns: ["Diseño de reportes o integraciones institucionales a medida, sujeto a revisión."],
      availability: availability("not_available", "No incluido en la oferta estándar", "El seguimiento institucional y los reportes para grupos se revisan con el equipo según las necesidades de cada proyecto.", []),
    }),
    benefit({
      id: "gina-assistant",
      category: "gina",
      name: "Asistente Gina",
      description: "Consultas en lenguaje natural y ayuda para ordenar registros con revisión humana cuando la acción modifica datos.",
      unit: "Por usuario autenticado",
      coverage: {
        free: { summary: "Consultas a Gina según disponibilidad del servicio", limits: ["Las acciones que cambian registros requieren confirmación"], frequency: "Según disponibilidad del servicio" },
        producer: { summary: "Consultas a Gina según disponibilidad del servicio", limits: ["Las acciones que cambian registros requieren confirmación"], frequency: "Según disponibilidad del servicio" },
        aggregator: { summary: "Consultas a Gina para cada cuenta habilitada", limits: ["Las acciones que cambian registros requieren confirmación"], frequency: "Según disponibilidad del servicio" },
      },
      exclusions: ["No reemplaza asesoría veterinaria, contable ni legal."],
      addOns: ["No se aprobó una bolsa adicional de consultas."],
      availability: availability("operational", "Asistente disponible", "Gina ayuda a organizar consultas y registros. Las acciones que modifican información requieren confirmación.", ["/api/asistente/chat", "/api/asistente/transcribir", "/api/asistente/ocr"]),
    }),
    benefit({
      id: "gina-monthly-quotas",
      category: "gina",
      name: "Cupos mensuales de Gina",
      description: "La política comercial define cupos individuales y un límite de duración de audio; audio y adjunto consumen además una consulta.",
      unit: "Por usuario y mes de servicio",
      coverage: {
        free: { summary: monthlyGinaFree, limits: [`Audio hasta ${offer.free.gina.maxAudioSeconds} segundos`, "Audio y adjunto consumen además una consulta", "El consumo no se acumula"], frequency: "Por usuario y mes calendario" },
        producer: { summary: monthlyGinaPaid, limits: [`Audio hasta ${offer.producer.gina.maxAudioSeconds} segundos`, "Audio y adjunto consumen además una consulta", "El consumo no se acumula"], frequency: "Por usuario y mes calendario" },
        aggregator: { summary: `${offer.aggregator.gina.queriesPerUser} consultas, ${offer.aggregator.gina.audiosPerUser} audios y ${offer.aggregator.gina.attachmentsPerUser} adjuntos por usuario/mes`, limits: ["Los cupos se asignan a cada persona; las cuentas de supervisión no cuentan como beneficiarios pagos", "Cada audio o adjunto consume además una consulta", "El consumo no se acumula"], frequency: "Por usuario y mes calendario" },
      },
      exclusions: ["Los cupos aplican a consultas de Gina, no a los registros ordinarios de la granja."],
      addOns: ["No se ofrece recarga adicional."],
      availability: availability("progressive", "Cupo mensual por persona", "La oferta define un cupo individual que se renueva cada mes. Al terminar el cupo de Gina, puedes seguir usando las demás funciones de IwaGranja.", ["/api/asistente/chat", "/api/asistente/transcribir", "/api/asistente/ocr", "/api/asistente/cuota"]),
    }),
    benefit({
      id: "qr-digital",
      category: "qr",
      name: "Generación y lectura de QR en la aplicación",
      description: "Crea y escanea códigos QR para ubicar registros, lotes, activos y animales.",
      unit: "Por entidad registrada",
      coverage: {
        free: { summary: "Funciones digitales disponibles según rol", limits: ["No incluye placas físicas"], frequency: "Durante el acceso" },
        producer: { summary: "Funciones digitales disponibles según rol", limits: ["El kit físico depende del plazo y alcance declarado"], frequency: "Durante el período contratado" },
        aggregator: { summary: "Funciones digitales disponibles por beneficiario habilitado", limits: ["El kit físico se estima con placas por beneficiario"], frequency: "Durante el período contratado" },
      },
      exclusions: ["La creación de un QR digital no supone que una placa se haya impreso o entregado."],
      addOns: ["Los materiales impresos se incluyen según las reglas del kit y el plan seleccionado."],
      availability: availability("operational", "QR digital disponible", "Puedes crear y escanear códigos QR para enlazar registros y espacios. Las placas físicas se entregan según el alcance de tu plan.", ["/escanear", "/api/operaciones/kit-campo/placas-qr"]),
    }),
    benefit({
      id: "physical-qr-kit",
      category: "qr",
      name: "Kit físico de placas QR",
      description: "Material impreso según localizaciones y áreas declaradas. El cálculo del plan no genera una orden de impresión.",
      unit: "Placa por localización y área",
      coverage: {
        free: { summary: "No incluido", limits: ["Kit físico excluido"], frequency: "No aplica" },
        producer: { summary: `Incluido desde ${offer.producer.physicalKitMinMonths} meses en alta inicial`, limits: [producerKitLimit, `Hasta ${offer.producer.includedAreasPerLocation} áreas incluidas por localización`], frequency: "Una vez al inicio o ampliación aprobada" },
        aggregator: { summary: `Estimación de ${offer.aggregator.assumedPlatesPerBeneficiary} placas por beneficiario activado`, limits: ["Confirma número real de localizaciones y áreas antes de imprimir"], frequency: "Una vez por cohorte inicial; no se repite en renovación" },
      },
      exclusions: ["La impresión y entrega se coordinan con el equipo."],
      addOns: [`Placas adicionales a precio marginal, hasta ${offer.maxExtraPlates} por cálculo.`],
      availability: availability("manual", "Entrega coordinada con el equipo", "La cantidad de placas se calcula con las localizaciones y áreas incluidas. El equipo coordina su impresión y entrega.", ["/api/operaciones/kit-campo/placas-qr"]),
    }),
    benefit({
      id: "shipping",
      category: "qr",
      name: "Envío de materiales",
      description: "Un despacho de materiales a un punto en una ciudad capital; otros destinos se acuerdan por separado.",
      unit: "Por pedido / punto de entrega",
      coverage: {
        free: { summary: "No aplica", limits: [], frequency: "No aplica" },
        producer: { summary: "Un despacho incluido cuando corresponde kit", limits: ["Un punto en ciudad capital", "Zona apartada y visita se confirman aparte"], frequency: "Una vez por pedido inicial" },
        aggregator: { summary: "Un punto consolidado por organización sujeto a confirmación", limits: ["Despachos múltiples, personal en campo y zonas apartadas requieren confirmación aparte"], frequency: "Por cohorte / pedido" },
      },
      exclusions: ["El estimador no calcula transportes remotos, visitas ni varios puntos de entrega."],
      addOns: ["La logística extraordinaria se confirma antes de contratar."],
      availability: availability("manual", "Entrega coordinada con el equipo", "El despacho estándar cubre un punto en ciudad capital. Otros destinos o varios puntos se acuerdan antes de contratar.", []),
    }),
    benefit({
      id: "training-portal",
      category: "training",
      name: "Guías y formación autoguiada",
      description: "Manuales y guías de uso públicos para aprender a operar IwaGranja.",
      unit: "Por cuenta / portal de contenidos",
      coverage: {
        free: { summary: "Guías públicas disponibles", limits: ["Sin sesiones en vivo incluidas"], frequency: "Autoguiada" },
        producer: { summary: "Portal de contenidos y bienvenida incluidos en política", limits: ["Bienvenida virtual coordinada manualmente"], frequency: "Durante el alta inicial" },
        aggregator: { summary: `${offer.aggregator.training.portalHours} horas de portal autoguiado dentro de una bolsa total de ${offer.aggregator.training.includedHours} horas por cohorte`, limits: ["La bolsa se comparte por cohorte, no por beneficiario"], frequency: "Por contrato inicial" },
      },
      exclusions: ["La guía pública no equivale a una sesión de formación impartida."],
      addOns: [`Paquetes adicionales de ${offer.extraTraining.packageHours} horas: ${formatCop(offer.extraTraining.packagePriceCop)}.`],
      availability: availability("operational", "Guías y manuales disponibles", "Consulta las guías y manuales de IwaGranja; las sesiones en vivo se coordinan con el equipo.", ["/guia", "/manual"]),
    }),
    benefit({
      id: "live-training",
      category: "training",
      name: "Formación facilitada",
      description: "Sesiones en vivo, autoguiadas y presenciales conforme al servicio contratado.",
      unit: "Hora por paquete o cohorte",
      coverage: {
        free: { summary: "No incluida; guías públicas autoguiadas", limits: [], frequency: "No aplica" },
        producer: { summary: "Bienvenida/acompañamiento virtual base según política", limits: ["No hay agenda integrada; requiere coordinación"], frequency: "Una vez en alta inicial" },
        aggregator: { summary: `${offer.aggregator.training.includedHours} horas compartidas por cohorte: ${offer.aggregator.training.virtualLiveHours} sincrónicas, ${offer.aggregator.training.portalHours} autoguiadas y ${offer.aggregator.training.inPersonHours} presenciales grupales`, limits: ["No se multiplica por beneficiario", "Viáticos y desplazamientos fuera del alcance"], frequency: "Una vez por cohorte inicial" },
      },
      exclusions: ["Las fechas, el lugar y los gastos de traslado se acuerdan con el equipo."],
      addOns: [`${offer.extraTraining.packageHours} horas adicionales por ${formatCop(offer.extraTraining.packagePriceCop)}; modalidad presencial y viáticos se confirman.`],
      availability: availability("manual", "Sesiones coordinadas con el equipo", "La formación incluida se organiza con el equipo de acuerdo con el período contratado.", ["/contacto"]),
    }),
    benefit({
      id: "accompaniment",
      category: "accompaniment",
      name: "Acompañamiento de implementación",
      description: "Bienvenida virtual para Productor y acompañamiento institucional sujeto al alcance acordado.",
      unit: "Por cuenta o cohorte",
      coverage: {
        free: { summary: "Ayuda de autoservicio", limits: ["Sin acompañamiento personalizado incluido"], frequency: "Según recursos públicos" },
        producer: { summary: "Bienvenida virtual base según política", limits: ["Se coordina por contacto; no es cita automatizada"], frequency: "Una vez al inicio" },
        aggregator: { summary: "Alcance de implementación se define con la cohorte", limits: ["El cálculo estándar no registra hitos de implementación"], frequency: "Según alcance acordado" },
      },
      exclusions: ["Despliegue dedicado, integraciones y visitas de campo no se presumen incluidos."],
      addOns: ["Implementación institucional única y alcance a medida cuando se formalicen."],
      availability: availability("manual", "Acompañamiento coordinado con el equipo", "El equipo acuerda contigo el inicio y el alcance del acompañamiento.", ["/contacto"]),
    }),
    benefit({
      id: "support-channel",
      category: "support",
      name: "Canal de soporte y contacto",
      description: "Formulario público de contacto para soporte, implementación y solicitudes de datos.",
      unit: "Por solicitud",
      coverage: {
        free: { summary: "Formulario de soporte disponible", limits: [`Tiempo de respuesta publicado: ${RESPONSE_TIME}`], frequency: "Por solicitud" },
        producer: { summary: "Formulario de soporte disponible", limits: [`Tiempo de respuesta publicado: ${RESPONSE_TIME}`], frequency: "Por solicitud" },
        aggregator: { summary: "Formulario de contacto; coordinación directa con el equipo", limits: [`Tiempo de respuesta publicado: ${RESPONSE_TIME}`, "No implica mesa de ayuda dedicada"], frequency: "Por solicitud" },
      },
      exclusions: ["No se encontró un SLA premium por plan ni soporte 24/7."],
      addOns: ["Soporte dedicado o integraciones pueden solicitarse a medida."],
      availability: availability("operational", "Canal de contacto disponible", `Puedes enviar tu solicitud por el formulario de contacto. Tiempo de respuesta: ${RESPONSE_TIME}.`, ["/contacto", "/api/contacto"]),
    }),
    benefit({
      id: "commercial-conditions",
      category: "conditions",
      name: "Condiciones de la oferta v2.3.2",
      description: "Consulta el precio, la permanencia y las condiciones de contratación de cada plan.",
      unit: "Por cálculo versionado",
      coverage: {
        free: { summary: "Acceso sin cobro", limits: ["Sin kit físico"], frequency: "Sin plazo prepago" },
        producer: { summary: "Prepago del período seleccionado; sin renovación automática", limits: [offer.taxPolicy.publicLabel, "Renovación solo por acción expresa", "Fidelidad de 5% solo en términos 3/6/12 cuando aplica"], frequency: "3, 6, 12 o 18 meses" },
        aggregator: { summary: "Propuesta y puesta en marcha con acompañamiento del equipo; renovación con beneficio de continuidad", limits: ["Desde " + offer.aggregator.minPaidBeneficiaries + " beneficiarios pagos", "5% adicional al renovar una cohorte vigente en períodos de 3, 6 o 12 meses, después del descuento por plazo", "Sin ampliaciones, no se repiten implementación ni kit inicial; el contrato y el tamaño del grupo se revisan con el FarmID"], frequency: offer.aggregator.terms.map((term) => term.months).join(", ") + " meses" },
      },
      exclusions: ["La renovación no se cobra automáticamente.", "Logística fuera del punto estándar, visitas e integraciones se confirman antes de contratar."],
      addOns: ["Productor permite continuar al pago en línea. Organización se activa con acompañamiento del equipo."],
      availability: availability(
        reservationsCheckoutConfigured ? "operational" : "policy_only",
        reservationsCheckoutConfigured ? "Pago en línea disponible" : "Pago en línea sujeto a disponibilidad",
        reservationsCheckoutConfigured
          ? "Puedes revisar las condiciones y continuar al pago centralizado. Tu suscripción se activa al confirmarse el resultado."
          : "Antes de pagar, te confirmaremos la disponibilidad del pago en línea. Organización se coordina con el equipo.",
        ["/planes", "/api/billing/checkout", "/api/billing/reservas", "/api/pagos/intentos"],
      ),
    }),
  ];

  return {
    version: "iwagranja-catalog-v1",
    policyVersion: offer.policyVersion,
    planEntitlementsConnected: true,
    permissionModel: "Los roles controlan el acceso de cada persona a los módulos. El plan contratado determina cupos de usuarios, ubicaciones activas, lotes por especie y consumo mensual de Gina; estos límites se aplican en servidor. Las banderas progresivas siguen gobernando la habilitación gradual del producto.",
    contractingFlowAvailable: reservationsCheckoutConfigured,
    categories: CATEGORIES,
    benefits,
    auditNotes: [
      reservationsCheckoutConfigured
        ? "El checkout de Productor recalcula el total en IwaGranja, crea el intento en Reservas y espera la confirmación firmada antes de activar el plan."
        : "El checkout de Productor requiere que el canal servidor a servidor con Reservas esté configurado antes de abrir pagos.",
      "Las nuevas altas Gratis usan un usuario y los límites de la política; las cuentas actuales no se migraron ni se modificaron. El registro nuevo aplica una plaza de usuario y la app limita ubicaciones activas y lotes por especie.",
      "Los cupos de Gina se controlan en chat, voz y adjuntos y su consumo se registra por persona y mes. Los registros ordinarios de la granja no se bloquean al agotarse un cupo.",
      "Organización distingue beneficiarios de usuarios, pero la app no tiene padrón de beneficiarios ni acceso multipredio; no permite checkout hasta habilitar esos alcances.",
      "La política incluye Torre de Control y M&E en Organización, pero el módulo no se encontró operativo; no se ofrece como capacidad disponible.",
      "Tratamiento tributario aplicado desde la política versionada " + offer.taxPolicy.version + ": " + offer.taxPolicy.publicLabel,
    ],
  };
}

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)} COP`;
}
