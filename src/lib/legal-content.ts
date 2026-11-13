import { LEGAL, PLAN_PROMISES, RESPONSE_TIME, SIC_LABEL, SIC_URL } from "@/lib/legal";

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
      "Estos términos regulan el uso de la plataforma El Gallinero · Iwagé Granja. Al crear tu granja o pagar un ciclo declaras que los leíste y aceptas.",
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
          "Hay un plan gratuito Semilla (30 días completos y luego 1 lote activo) y planes pagos por ciclo: Ciclo Engorde 60 días, Semestral 180 días (con opción anual) y Escala Mediano con cobro mensual de 30 días.",
          `${PLAN_PROMISES.pricesCop} ${LEGAL.ivaNote}. El valor vigente de cada plan es el que se muestra en la página de planes y en el momento del pago.`,
        ],
      },
      {
        title: "4. Renovación y vencimiento",
        paragraphs: [
          `${PLAN_PROMISES.noAutoCharge} Cada ciclo se paga de forma voluntaria y por adelantado con Nequi, Daviplata o PSE a través de Wompi; solo se renueva cuando tú lo decides.`,
          PLAN_PROMISES.expiry,
          "Al vencer el ciclo, la cuenta pasa al plan gratuito Semilla: puedes consultar tu historial, cerrar y vender tu lote en curso y mantener 1 lote activo. Para abrir más lotes o usar las funciones del plan pago debes renovar.",
        ],
      },
      {
        title: "5. Pagos",
        paragraphs: [
          "Los pagos los procesa Wompi. No almacenamos datos de tu tarjeta ni de tu cuenta bancaria. El plan se activa cuando Wompi confirma la transacción como aprobada.",
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
      "Cómo pedir el retracto o un reembolso de un ciclo pagado, en qué plazo y por qué canal.",
    sections: [
      {
        title: "1. Derecho de retracto",
        paragraphs: [
          "Como compra a distancia, puedes ejercer el derecho de retracto dentro de los 5 días hábiles siguientes al pago, conforme al Estatuto del Consumidor (Ley 1480 de 2011). Si el retracto procede, devolvemos el valor pagado.",
          "Los ciclos son prepagados y el servicio se activa al confirmarse el pago. La forma en que el retracto aplica cuando ya usaste el ciclo será la que confirme la asesoría jurídica antes de publicar esta política de forma definitiva.",
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
          "Puedes cambiar de plan al renovar. No hay cobros automáticos ni permanencia, por lo que nada se renueva sin tu pago.",
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
          "Nombre, usuario, celular o correo, contraseña (guardada cifrada), nombre y ubicación de la granja, y los registros productivos, sanitarios y comerciales que tú ingresas. Los pagos los procesa Wompi; no guardamos datos de tarjetas.",
        ],
      },
      {
        title: "3. Finalidades",
        paragraphs: [
          "Crear y operar tu cuenta, prestar el servicio, procesar pagos, darte soporte, enviarte avisos del servicio (por ejemplo, vencimiento de un ciclo) y mejorar la plataforma con estadísticas agregadas.",
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
          "El registro en el RNBD aplica a las sociedades con activos totales superiores a 100.000 UVT. Aunque no esté obligado, el responsable cumple el resto de la Ley 1581.",
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
    q: "¿Cómo pago un ciclo?",
    a: "Entras a Configuración, luego a Plan y pagos, eliges el plan y el medio: Nequi, Daviplata o PSE. El pago lo procesa Wompi en su página segura. Cuando Wompi confirma la transacción, tu plan se activa. No necesitas tarjeta de crédito ni guardamos tus datos bancarios.",
  },
  {
    q: "¿Me cobran automáticamente cada mes?",
    a: PLAN_PROMISES.noAutoCharge + " Cada ciclo lo pagas tú, cuando quieras, y por adelantado. Si no pagas, simplemente no se renueva y tu cuenta sigue en el plan gratuito.",
  },
  {
    q: "¿Qué pasa cuando vence mi ciclo?",
    a: "Tu cuenta pasa al plan gratuito Semilla. " + PLAN_PROMISES.expiry + " Para abrir más lotes o recuperar las funciones del plan pago solo tienes que renovar.",
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
    a: "30 días con todas las funciones y, después, 1 lote activo gratis de forma permanente. Siempre puedes consultar tu historial y cerrar o vender el lote en curso. No pedimos tarjeta para empezar.",
    image: { src: "/images/guia/inicio-dashboard.webp", alt: "Tablero de inicio" },
  },
  {
    q: "¿Quién puede ver los datos de mi granja?",
    a: "Solo las personas a las que tú das acceso con un usuario. Cada granja tiene su espacio aislado de las demás. Tú defines los roles: propietario, gerente, veterinario u operario. Tratamos tus datos según nuestra política de tratamiento de datos.",
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
  },
];

export const NOSOTROS_TEXT =
  "El Gallinero es una herramienta para granjas mixtas de Colombia, desarrollada en Ibagué por Camilo Saldarriaga bajo la marca Iwagé. Se probó primero en un gallinero real en Ambalá, y por eso está pensada para el galpón: se usa desde el celular, funciona sin señal y registra huevos, alimento, sanidad, trazabilidad y cuentas en un solo lugar. Es de código abierto, para que nadie quede atado a tus datos. Puedes conocer la historia completa en iwage.co y escribirnos cuando quieras desde la página de contacto.";
