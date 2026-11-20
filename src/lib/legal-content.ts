import { LEGAL, RESPONSE_TIME, SIC_LABEL, SIC_URL } from "@/lib/legal";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  slug: "terminos" | "retracto" | "privacidad";
  title: string;
  intro: string;
  sections: LegalSection[];
}

export function getTerminos(): LegalDocument {
  return {
    slug: "terminos",
    title: "Términos y condiciones de uso",
    intro:
      "Estos términos regulan el uso de IwaGranja. Al crear tu granja o pagar un ciclo declaras que los leíste y aceptas.",
    sections: [
      {
        title: "1. Quién opera el sitio",
        paragraphs: [
          `El sitio ${LEGAL.sitio} es operado por ${LEGAL.razonSocial}, identificado con NIT/RUT ${LEGAL.nit}, con domicilio en ${LEGAL.ciudad}. Correo de contacto: ${LEGAL.email}. WhatsApp: ${LEGAL.whatsapp}.`,
        ],
      },
      {
        title: "2. Qué es el servicio",
        paragraphs: [
          "Es un software en línea para llevar el registro de una granja: animales, huevos, alimento, sanidad, trazabilidad, ventas y costos, desde el celular y con modo sin señal. El contenido de la plataforma (guías, plantillas, cálculos y calendarios sanitarios de referencia) es informativo.",
          "Cada granja tiene un espacio aislado. Tú eres responsable de la veracidad de los datos que registras y de custodiar tus claves de acceso.",
        ],
      },
      {
        title: "3. Planes, precios e IVA",
        paragraphs: [
          "La oferta incluye Gratis y Productor para granjas, y Organización y A la medida para proyectos. La página de planes presenta las prestaciones, cantidades, plazos y condiciones comerciales vigentes.",
          "Para Productor, revisas el resumen de tu suscripción y aceptas las condiciones antes de continuar al checkout de Wompi cuando esté habilitado. La compra se registra con la política comercial vigente y el plan se activa al confirmarse el pago. Organización y A la medida requieren validación institucional y no abren un checkout individual.",
          "Los costos se expresan en pesos colombianos (COP). Según la política comercial vigente, no se cobra IVA; el checkout muestra y envía a pago el total final del plan. Los costos logísticos extraordinarios se confirman antes de contratar.",
          "Las suscripciones pagadas anteriores conservan las condiciones aceptadas al contratarlas; esta página no modifica sus derechos, pagos ni vigencia.",
        ],
      },
      {
        title: "4. Renovación y vencimiento",
        paragraphs: [
          "La revisión del costo no inicia un cobro. Para renovar Productor, vuelves a seleccionar las condiciones, revisas el total y aceptas expresamente antes de pagar. No hay renovación automática.",
          "Las cuentas con una suscripción anterior mantienen el plazo y las condiciones aceptadas al contratarla. Cuando vence, se aplican los límites vigentes del nivel Gratis; los registros históricos se conservan.",
          "El beneficio de continuidad del 5% aplica a los plazos elegibles una vez verificado el FarmID de Productor o el contrato institucional de Organización. Se calcula después de los descuentos por cantidad y permanencia y no se acumula entre renovaciones.",
          "Antes de ofrecer una renovación o un nuevo servicio pagado, se informarán el plazo, los cupos, el valor total y las condiciones aplicables para su aceptación expresa.",
        ],
      },
      {
        title: "5. Pagos",
        paragraphs: [
          "Productor puede contratarse desde el checkout de Wompi cuando la pasarela está configurada en el servidor. La suscripción se activa al confirmar el pago. Organización requiere validar el proyecto y habilitar el control de beneficiarios antes de contratar. IwaGranja no almacena datos de tarjetas ni de cuentas bancarias.",
        ],
      },
      {
        title: "6. Inteligencia artificial (Gina)",
        paragraphs: [
          "El asistente Gina usa inteligencia artificial para ayudarte a registrar y consultar datos. Puede equivocarse. Sus respuestas no son asesoría veterinaria, contable ni legal; revisa lo que registra antes de confirmar y consulta a un profesional para decisiones sanitarias o tributarias.",
        ],
      },
      {
        title: "7. Tus datos y su exportación",
        paragraphs: [
          "Los datos de tu granja son tuyos. Puedes exportarlos en Excel o CSV desde Reportes en cualquier momento, también después de vencido un ciclo. Puedes pedir la eliminación de tu cuenta por los canales de contacto.",
          "El tratamiento de datos personales se rige por la Política de tratamiento de datos.",
        ],
      },
      {
        title: "8. No reemplaza certificaciones oficiales",
        paragraphs: [
          "La plataforma ayuda a llevar registros alineados con buenas prácticas (por ejemplo, referencias del ICA y la NTC 1240), pero no reemplaza certificaciones, registros, inspecciones ni autorizaciones del ICA, del INVIMA ni de ninguna otra autoridad. El cumplimiento normativo sigue siendo responsabilidad del productor.",
        ],
      },
      {
        title: "9. Disponibilidad y responsabilidad",
        paragraphs: [
          "Trabajamos para mantener el servicio disponible, pero no garantizamos que funcione sin interrupciones. Salvo lo que la ley no permita limitar, no respondemos por decisiones tomadas con base en los datos registrados ni por pérdidas indirectas.",
        ],
      },
      {
        title: "10. Retracto, reembolsos y reclamos",
        paragraphs: [
          "El procedimiento de retracto y reembolsos está en la Política de retracto y reembolsos. Para reclamos escríbenos y responderemos en " +
            `${RESPONSE_TIME}. También puedes acudir a la ${SIC_LABEL}: ${SIC_URL}.`,
        ],
      },
      {
        title: "11. Cambios y ley aplicable",
        paragraphs: [
          "Si cambiamos estos términos, publicaremos la nueva versión con su fecha y avisaremos en la plataforma. Rige la ley colombiana.",
        ],
      },
    ],
  };
}

export function getRetracto(): LegalDocument {
  return {
    slug: "retracto",
    title: "Política de retracto, cambios y reembolsos",
    intro:
      "Cómo pedir el retracto o un reembolso de un ciclo pagado, en qué plazo y por qué canal. El cálculo actual no genera pagos; estas condiciones aplican a pagos históricos y a los contratos que indiquen expresamente su aplicación.",
    sections: [
      {
        title: "1. Derecho de retracto",
        paragraphs: [
          "Como compra a distancia, puedes ejercer el derecho de retracto dentro de los 5 días hábiles siguientes al pago, conforme al Estatuto del Consumidor (Ley 1480 de 2011). Si el retracto procede, devolvemos el valor pagado.",
          "Los ciclos son prepagados y el servicio se activa al confirmarse el pago. Si ejerces el retracto dentro de los 5 días hábiles siguientes al pago sin haber consumido el ciclo productivo, reintegramos el 100 % del valor pagado sin descuentos ni retenciones.",
        ],
      },
      {
        title: "2. Cómo solicitarlo",
        paragraphs: [
          `Escríbenos a ${LEGAL.email} o por WhatsApp al ${LEGAL.whatsapp} con el nombre de tu granja, el usuario y la referencia del pago. Respondemos en ${RESPONSE_TIME}.`,
        ],
      },
      {
        title: "3. Plazo y forma del reembolso",
        paragraphs: [
          "Si el reembolso procede, lo hacemos por el mismo medio de pago (Nequi, Daviplata o PSE a través de Wompi). El tiempo en que se refleja depende de la entidad financiera.",
        ],
      },
      {
        title: "4. Cambios de plan",
        paragraphs: [
          "El cálculo del precio no modifica por sí solo una suscripción. Los cambios o nuevas suscripciones requieren revisar las condiciones vigentes y aceptarlas expresamente antes del pago.",
        ],
      },
      {
        title: "5. Si no estás conforme",
        paragraphs: [
          `Puedes presentar peticiones, quejas y reclamos por nuestros canales, y acudir a la ${SIC_LABEL}: ${SIC_URL}.`,
        ],
      },
    ],
  };
}

export function getPrivacidad(): LegalDocument {
  return {
    slug: "privacidad",
    title: "Política de tratamiento de datos personales",
    intro:
      "Cómo tratamos tus datos personales, conforme a la Ley 1581 de 2012 y sus decretos reglamentarios.",
    sections: [
      {
        title: "1. Responsable del tratamiento",
        paragraphs: [
          `${LEGAL.razonSocial}, NIT/RUT ${LEGAL.nit}, ${LEGAL.ciudad}. Correo: ${LEGAL.email}. WhatsApp: ${LEGAL.whatsapp}.`,
        ],
      },
      {
        title: "2. Datos que recolectamos",
        paragraphs: [
          "Nombre, usuario, celular o correo, contraseña (guardada cifrada), nombre y ubicación de la granja, y los registros productivos, sanitarios y comerciales que tú ingresas. Si se procesa un pago de una suscripción, Wompi gestiona la transacción; no guardamos datos de tarjetas.",
        ],
      },
      {
        title: "3. Finalidades",
        paragraphs: [
          "Crear y operar tu cuenta, prestar el servicio, gestionar pagos asociados a contratos vigentes o históricos, darte soporte, enviarte avisos del servicio y mejorar la plataforma con estadísticas agregadas.",
        ],
      },
      {
        title: "4. Tus derechos",
        paragraphs: [
          "Como titular puedes conocer, actualizar y rectificar tus datos, solicitar prueba de la autorización, ser informado del uso que les damos, presentar quejas ante la SIC, revocar la autorización y pedir la supresión de tus datos, y acceder a ellos gratuitamente.",
        ],
      },
      {
        title: "5. Cómo ejercer tus derechos",
        paragraphs: [
          `Escribe a ${LEGAL.email} indicando que es una consulta o reclamo sobre datos personales. Respondemos en ${RESPONSE_TIME} y resolvemos dentro de los plazos de la ley.`,
        ],
      },
      {
        title: "6. Autorización",
        paragraphs: [
          "Al registrarte marcas de forma expresa una casilla, sin premarcar, con la que autorizas este tratamiento. Guardamos la fecha y la versión de lo que aceptaste.",
        ],
      },
      {
        title: "7. Seguridad y conservación",
        paragraphs: [
          "Aplicamos medidas técnicas para proteger la información, con aislamiento de datos por granja. Conservamos los datos mientras tengas cuenta y el tiempo que exija la ley.",
        ],
      },
      {
        title: "8. Registro Nacional de Bases de Datos (RNBD)",
        paragraphs: [
          `El registro en el RNBD aplica únicamente a sociedades con activos totales superiores a 100.000 UVT (Decreto 090 de 2018). Como ${LEGAL.tipoPersona} no obligada a inscribirse en el RNBD, ${LEGAL.razonSocial} cumple íntegramente el resto de las obligaciones de la Ley 1581 de 2012.`,
        ],
      },
      {
        title: "9. Analítica web y medición sin cookies de seguimiento",
        paragraphs: [
          "Para medir el rendimiento del sitio público y conocer desde qué buscadores, enlaces del ecosistema o asistentes de IA nos visitan, utilizamos analítica agregada sin cookies de rastreo publicitario ni perfiles individuales de comportamiento.",
          "Dentro de la aplicación solo usamos la cookie técnica estrictamente necesaria para mantener tu sesión autenticada y el almacenamiento local cifrado del navegador para guardar registros cuando trabajas sin conexión en el galpón.",
        ],
      },
    ],
  };
}

export interface FaqItem {
  q: string;
  a: string;
  image?: { src: string; alt: string };
}

export const FAQS: FaqItem[] = [
  {
    q: "¿Cómo calculo el costo o contrato un plan?",
    a: "En Planes compara Gratis y Productor para tu granja, u Organización y A la medida para un proyecto. Configura personas y plazo, revisa el resumen y las condiciones, y continúa al checkout para pagar Productor cuando Wompi esté habilitado. La suscripción se activa al confirmarse el pago. Para el 5% de continuidad se verifica el FarmID de Productor o el contrato de Organización. Organización requiere validación institucional antes de contratar.",
    image: { src: "/images/guia/configuracion-panel.webp", alt: "Estado del plan y límites de uso de la granja" },
  },
  {
    q: "¿Me cobran automáticamente cada mes?",
    a: "No. Los planes pagados se prepagan por el período elegido y no se renuevan automáticamente. El pago requiere aceptar las condiciones en el checkout.",
    image: { src: "/images/guia/finanzas-presupuestos.webp", alt: "Control de presupuestos y pagos por ciclo sin cobros automáticos" },
  },
  {
    q: "¿Qué pasa cuando vence mi ciclo?",
    a: "Las suscripciones anteriores vencidas pasan al nivel Gratis y se aplican sus cupos. El historial se conserva. Calcular el costo de un plan nuevo no cambia ni renueva una cuenta.",
    image: { src: "/images/guia/animales-resumen.webp", alt: "Resumen de lotes e historial siempre visible en tu granja" },
  },
  {
    q: "¿Puedo exportar mis datos?",
    a: "Sí. En Análisis, Reportes puedes descargar tus registros en Excel o CSV cuando quieras, también después de vencido un ciclo. Tus datos son tuyos. Si deseas eliminar tu cuenta, escríbenos y lo gestionamos.",
    image: { src: "/images/guia/finanzas-balance.webp", alt: "Pantalla de finanzas y balance" },
  },
  {
    q: "¿Funciona sin señal en la finca?",
    a: "Sí. Puedes registrar huevos, alimento, sanidad y ventas sin internet. La información queda guardada cifrada en tu celular y se sincroniza sola cuando vuelve la señal. Conviene abrir la app una vez con internet para que quede lista.",
    image: { src: "/images/guia/captura-rapida-modal.webp", alt: "Captura rápida en campo" },
  },
  {
    q: "¿Qué incluye el plan gratuito?",
    a: "Gratis incluye un usuario, una localización activa y hasta un lote activo por especie. Gina tiene 10 consultas, 2 audios y 2 adjuntos por usuario al mes; cada audio o adjunto consume además una consulta. Los módulos disponibles dependen del rol y de la habilitación progresiva. No incluye kit físico.",
    image: { src: "/images/guia/inicio-dashboard.webp", alt: "Tablero de inicio" },
  },
  {
    q: "¿Quién puede ver los datos de mi granja?",
    a: "Solo las personas a las que tú das acceso con un usuario. Cada granja tiene su espacio aislado de las demás. Tú defines los roles: propietario, gerente, veterinario u operario. Tratamos tus datos según nuestra política de tratamiento de datos.",
    image: { src: "/images/guia/ubicaciones-lista.webp", alt: "Espacio aislado por granja y administración de lugares y usuarios" },
  },
  {
    q: "¿Gina, el asistente, reemplaza al veterinario?",
    a: "No. Gina usa inteligencia artificial para ayudarte a registrar y consultar datos, y puede equivocarse. Revisa lo que registra antes de confirmar. No es asesoría veterinaria, contable ni legal: para decisiones sanitarias consulta a un profesional.",
    image: { src: "/images/guia/asistente-ia.webp", alt: "Asistente Gina" },
  },
  {
    q: "¿Reemplaza las certificaciones del ICA o del INVIMA?",
    a: "No. La plataforma te ayuda a llevar registros alineados con buenas prácticas, como los tiempos de retiro y la clasificación NTC 1240, pero no reemplaza certificaciones, inspecciones ni autorizaciones del ICA, del INVIMA ni de otra autoridad.",
    image: { src: "/images/guia/sanidad-control.webp", alt: "Control sanitario" },
  },
  {
    q: "¿Cómo pido un reembolso o ejerzo el retracto?",
    a: "Escríbenos desde la página de contacto con el nombre de tu granja y la referencia del pago. Respondemos en 1 día hábil. Los plazos y condiciones están en la política de retracto y reembolsos.",
    image: { src: "/images/guia/finanzas-cuentas.webp", alt: "Historial de cuentas, pagos y soporte al productor" },
  },
  {
    q: "¿Qué especies puedo registrar?",
    a: "IwaGranja permite gestionar gallinas ponedoras, pollos de engorde, codornices, patos, conejos y curíes. Las opciones disponibles dependen del módulo y del tipo de registro.",
    image: { src: "/images/guia/animales-resumen.webp", alt: "Gestión de distintas especies animales en la granja" },
  },
  {
    q: "¿Puedo registrar de dónde vienen mis animales?",
    a: "Sí. Puedes llevar el ingreso y la procedencia de los animales para conservar la trazabilidad desde su adquisición. La información genética registrada depende de los datos disponibles para el animal o el lote.",
    image: { src: "/images/guia/adquisiciones-genetica.webp", alt: "Registro de adquisición y procedencia de los animales" },
  },
  {
    q: "¿Puedo organizar los animales por corral, jaula o galpón?",
    a: "Sí. Los lugares de manejo permiten organizar registros por espacios de la finca, como corrales, jaulas, galpones o potreros, y consultar el desempeño con mayor detalle.",
    image: { src: "/images/guia/ubicaciones-lista.webp", alt: "Lugares de manejo y ubicación dentro de la finca" },
  },
  {
    q: "¿Los registros propuestos por Gina se guardan solos?",
    a: "No. Gina puede ayudarte a preparar un registro o responder una consulta. Revisa los datos y confirma las acciones antes de guardarlas, especialmente cuando cambian inventarios, ventas o movimientos.",
    image: { src: "/images/guia/asistente-ia.webp", alt: "Gina ayuda a preparar registros para revisión" },
  },
];

export const NOSOTROS_TEXT =
  "IwaGranja es una herramienta para granjas mixtas de Colombia, desarrollada en Ibagué por Camilo Saldarriaga bajo la marca Iwagé. Se probó primero en un gallinero real en Ambalá, y por eso está pensada para el galpón: se usa desde el celular, funciona sin señal y registra huevos, alimento, sanidad, trazabilidad y cuentas en un solo lugar. Es de código abierto, para que nadie quede atado a tus datos. Puedes conocer la historia completa en iwage.co y escribirnos cuando quieras desde la página de contacto.";
