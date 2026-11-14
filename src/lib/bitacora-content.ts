export interface BitacoraSection {
  heading: string;
  paragraphs: string[];
}

export interface BitacoraArticle {
  slug: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  readingMinutes: number;
  category: string;
  summary: string;
  realFarmData: {
    label: string;
    fact: string;
  };
  image: {
    src: string;
    alt: string;
  };
  sections: BitacoraSection[];
}

export const BITACORA_CTA_LABEL = "Crear mi granja gratis";
export const BITACORA_CADENCE_NOTE = "Cadencia editorial: 2 guías prácticas al mes basadas en operación real en campo.";

export function countArticleWords(article: BitacoraArticle): number {
  const chunks = [
    article.title,
    article.subtitle,
    article.summary,
    article.realFarmData.label,
    article.realFarmData.fact,
    ...article.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
  ];
  return chunks.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

export const BITACORA_ARTICLES: BitacoraArticle[] = [
  {
    slug: "cuanto-cuesta-producir-un-huevo",
    title: "Cuánto cuesta producir un huevo en una granja mixta",
    subtitle: "Cómo separar el alimento por especie, evitar el subsidio cruzado y calcular tu punto de equilibrio diario en pesos colombianos.",
    publishedAt: "2026-11-01",
    readingMinutes: 4,
    category: "Costos y rentabilidad",
    summary:
      "La mayoría de los productores pequeños conoce el precio al que vende la cubeta, pero no sabe cuánto le cuesta producir cada huevo porque mezcla el concentrado de postura con el de engorde o los gastos domésticos de la finca.",
    realFarmData: {
      label: "Dato real del gallinero piloto en Ambalá (Ibagué)",
      fact: "Con bultos de concentrado de postura de 40 kg alrededor de $118.000 COP ($2.950/kg), cada gallina consume en promedio entre 115 y 120 gramos diarios ($340 a $354 COP solo en alimento). Cuando la postura cae por debajo del 72 %, el costo alimenticio supera los $475 COP por huevo antes de sumar empaque, vacunas y reemplazo.",
    },
    image: {
      src: "/images/guia/finanzas-balance.webp",
      alt: "Panel de balance, utilidad y costo unitario por huevo en El Gallinero",
    },
    sections: [
      {
        heading: "1. El error silencioso del subsidio cruzado",
        paragraphs: [
          "En muchas granjas familiares de Colombia conviven gallinas ponedoras, pollos de engorde, conejos o algunas codornices en el mismo predio. El bolsillo suele ser uno solo: con lo que entra por la venta de huevos de la mañana se paga el bulto de engorde o el arreglo de un bebedero. A fin de mes queda dinero en caja o falta plata, pero es imposible saber cuál unidad está dando ganancia y cuál está consumiendo la utilidad de las demás.",
          "Para conocer el costo real de producir un huevo es obligatorio separar primero los egresos directos por especie y lote. Un bulto de 40 kilogramos de alimento para pollo de engorde no debe sumarse al centro de costos de postura. Lo mismo ocurre con vacunas, vitaminas, empaques tipo cubeta y mano de obra asignada.",
        ],
      },
      {
        heading: "2. Fórmula práctica: alimento, gastos directos y prorrateo",
        paragraphs: [
          "El alimento representa normalmente entre el 65 % y el 75 % del costo total de un huevo comercial. Si llevas inventario por kilogramos en vez de anotar solo el valor de la factura cuando compras el bulto, puedes medir cuántos kilogramos consumió el lote de ponedoras cada día y multiplicarlos por el costo real por kilo de ese ingreso específico.",
          "Al costo del alimento se deben sumar dos componentes que casi siempre se olvidan: primero, la depreciación o reposición de la pollona (dividir lo que costó levantar la ave hasta el inicio de postura entre los huevos que producirá en su ciclo útil); segundo, los gastos compartidos de la finca como energía, agua, desinfección y jornales, prorrateados por cabeza o por biomasa viva.",
        ],
      },
      {
        heading: "3. Cómo leer tu punto de equilibrio sin fórmulas enredadas",
        paragraphs: [
          "El punto de equilibrio unitario responde una sola pregunta antes de aceptar un pedido en la tienda del pueblo o con un distribuidor: ¿por debajo de qué precio por huevo empiezo a perder dinero? Si tu costo total de los últimos treinta días dividido por los huevos aptos para venta da $440 COP, vender la cubeta de 30 unidades a $12.600 COP ($420 cada huevo) significa entregar $20 pesos de pérdida por cada postura.",
          "Cuando además clasificas la producción por tamaños (AA, A, B) y separas lo que consume la familia en la casa como autoconsumo valorizado, evitas el error de creer que el gallinero dio pérdida simplemente porque diez huevos diarios se quedaron en la cocina.",
        ],
      },
      {
        heading: "4. Tres acciones inmediatas desde el galpón",
        paragraphs: [
          "Primero, pesa un balde o taza medidora de referencia y controla los bultos de 40 kg que salen de bodega con días de cobertura visibles. Segundo, anota diariamente huevos totales, rotos y descartados para detectar cuándo una caída en el porcentaje de postura está disparando el costo unitario. Tercero, revisa la utilidad neta separada por especie cada semana para ajustar precios de cubeta antes de que el incremento del maíz o del concentrado se coma el capital de trabajo.",
        ],
      },
    ],
  },
  {
    slug: "tiempos-de-retiro-medicamentos-veterinarios",
    title: "Tiempos de retiro de medicamentos veterinarios: qué son y cómo evitar sanciones",
    subtitle: "Cómo proteger al consumidor, cumplir la normativa ICA en granja y bloquear automáticamente la venta de huevos o carne en periodo de carencia.",
    publishedAt: "2026-11-04",
    readingMinutes: 4,
    category: "Sanidad y bioseguridad",
    summary:
      "Aplicar un antibiótico, antiparasitario o coccidiostato sin registrar el día exacto de finalización del tiempo de retiro expone a los compradores a residuos químicos y puede frenar cualquier comercialización formal ante el ICA o el INVIMA.",
    realFarmData: {
      label: "Dato real del gallinero piloto en Ambalá (Ibagué)",
      fact: "Durante un tratamiento antiparasitario oral aplicado en corral de levante con etiqueta comercial de 7 días de carencia, separar el grupo afectado dejó visibles 148 huevos que habrían entrado por error al inventario vendible si no existiera un bloqueo sanitario por fecha.",
    },
    image: {
      src: "/images/guia/sanidad-control.webp",
      alt: "Control sanitario con cálculo automático de fecha de retiro en El Gallinero",
    },
    sections: [
      {
        heading: "1. Qué significa realmente el tiempo de retiro en avicultura y cunicultura",
        paragraphs: [
          "Todo medicamento veterinario tiene un tiempo mínimo que debe transcurrir entre la última dosis administrada al animal y el momento en que sus huevos o su carne quedan libres de residuos por debajo del límite máximo permitido. Ese intervalo se conoce como tiempo de retiro o periodo de carencia, y viene impreso en la etiqueta aprobada por el ICA en cada frasco o sobre.",
          "Confundir la duración del tratamiento con el tiempo de retiro es uno de los fallos más frecuentes en campo. Si un fármaco se suministra durante 3 días y la etiqueta indica 10 días de retiro, la restricción sanitaria termina el día 13 contado desde el inicio, no al terminar las tomas.",
        ],
      },
      {
        heading: "2. Riesgos sanitarios, comerciales y de reputación",
        paragraphs: [
          "Para un productor pequeño o mediano que vende huevos campesinos en tiendas locales, restaurantes o plazas de mercado, un lote contaminado con trazas de sulfas, tetraciclinas o desparasitantes genera un daño doble: pone en riesgo la salud de quien lo consume y destruye la confianza que tomó meses construir.",
          "En fincas que aspiran a certificación de Granja Avícola Biosegura bajo las resoluciones 3650, 3651 y 3652 del ICA, los inspectores revisan la coherencia entre las facturas o recetas veterinarias, el kardex de medicamentos y la fecha en que salieron huevos o aves en pie del mismo galpón.",
        ],
      },
      {
        heading: "3. Cómo llevar el control sin depender de la memoria",
        paragraphs: [
          "Escribir con marcador en la pared del galpón funciona el primer día, pero se borra o se olvida cuando hay rotación entre operarios o cuando el propietario viaja al pueblo. Cada evento sanitario registrado debe quedar amarrado a cuatro datos concretos: producto comercial aplicado, lote afectado o galpón específico, días de retiro de la etiqueta y fecha calculada de liberación.",
          "En El Gallinero, cuando anotas un tratamiento con tiempo de retiro mayor a cero, el sistema calcula automáticamente la fecha límite (`retiro hasta`) y levanta un bloqueo preventivo al intentar vender huevo o carne de ese lote mientras el reloj siga corriendo. Si una ponedora debe tratarse de urgencia, el operario ve el aviso claro en pantalla antes de empacar la cubeta.",
          "También conviene dejar un registro separado del destino real de los huevos producidos durante esos días de carencia: nunca deben mezclarse con la producción comercial ni usarse para consumo humano familiar si la ficha técnica del fármaco lo prohíbe expresamente. Descartarlos hacia la pila de compostaje térmico o seguir las instrucciones del médico veterinario mantiene limpia la trazabilidad de punta a punta.",
        ],
      },
      {
        heading: "4. Buenas prácticas de bodega, receta veterinaria y cadena de frío",
        paragraphs: [
          "Junto con los tiempos de carencia, recuerda anotar lote del laboratorio, fecha de vencimiento del biológico y temperatura de la nevera cuando aplicas vacunas como Newcastle, Gumboro o Bronquitis. Mantener los medicamentos vencidos fuera de la bodega, usar únicamente productos aprobados con registro ICA visible y guardar copia legible de la prescripción veterinaria respalda la inocuidad de toda tu producción frente a clientes y autoridades.",
          "Cuando un comprador institucional o restaurante solicita soporte de manejo sanitario antes de cerrar un pedido semanal, poder exportar en segundos el historial limpio de tratamientos y fechas de liberación convierte una obligación normativa en una ventaja comercial difícil de igualar.",
        ],
      },
    ],
  },
  {
    slug: "clasificacion-de-huevo-ntc-1240",
    title: "Clasificación de huevo NTC 1240 e inventario PEPS para vender mejor",
    subtitle: "Tabla exacta de pesos en Colombia (Jumbo, AAA, AA, A, B y C), condiciones de almacenamiento en bodega y rotación por lotes sin huevos viejos.",
    publishedAt: "2026-11-06",
    readingMinutes: 4,
    category: "Calidad y empaque",
    summary:
      "Vender huevos sin pesar ni separar calibres hace que el comprador pague todo al precio del huevo pequeño mientras se lleva piezas AA y AAA gratis. Ordenar la recolección con la norma NTC 1240 mejora el margen desde la primera semana.",
    realFarmData: {
      label: "Dato real del gallinero piloto en Ambalá (Ibagué)",
      fact: "Al separar por calibre con gramera digital las recolecciones de gallinas Hy-Line e ISA Brown entre la semana 28 y la 42, el 64 % clasificó en AA y AAA, lo que permitió cobrar diferencia comercial por cubeta y bajar el huevo quebrado en bodega a menos del 1,8 %.",
    },
    image: {
      src: "/images/guia/produccion-huevos.webp",
      alt: "Registro diario de huevos por tamaño NTC 1240 y código PEPS",
    },
    sections: [
      {
        heading: "1. Rangos de peso de la Norma Técnica Colombiana NTC 1240",
        paragraphs: [
          "En Colombia la referencia estándar de calidad y peso del huevo de gallina para consumo comercial es la NTC 1240. Aunque algunos compradores en vereda piden simplemente huevo grande o mediano, clasificar exactamente por gramos te da poder de negociación en panaderías, supermercados y pedidos directos a domicilio.",
          "Los seis calibres oficiales que usamos también en el tablero de postura son: Jumbo para pesos superiores a 78 gramos; AAA entre 67 y 77,9 gramos; AA entre 60 y 66,9 gramos; A entre 53 y 59,9 gramos; B entre 46 y 52,9 gramos; y C para huevos por debajo de 46 gramos. Un huevo quebrado o con fisura visible no debe entrar a la cubeta comercial aunque cumpla el peso.",
          "Pesar una muestra rápida al inicio de la clasificación permite calibrar el ojo del operario en pocos días y detectar de inmediato cambios en la postura provocados por estrés calórico o ajustes en la fórmula de alimento.",
        ],
      },
      {
        heading: "2. Por qué combinar clasificación con inventario PEPS",
        paragraphs: [
          "PEPS significa Primero en Entrar, Primero en Salir. Cuando en la bodega se apilan las cubetas del lunes detrás de las del martes y se despachan las de adelante porque quedan más a la mano, el cliente final termina recibiendo huevo de hace diez o doce días mientras el producto fresco del día sigue esperando en el fondo.",
          "Cada recolección diaria debe generar un código de lote trazable por fecha y especie. Así, al momento de empacar un pedido de veinte cubetas, el encargado sabe exactamente qué estiba salió primero y el cliente puede escanear el QR del lote para ver la fecha de postura, las condiciones sanitarias del galpón y la vereda de origen.",
        ],
      },
      {
        heading: "3. Temperatura y humedad en el cuarto de almacenamiento",
        paragraphs: [
          "La frescura no depende solamente de la fecha: un huevo almacenado a 27 °C junto a un techo de zinc sin ventilación pierde humedad por los poros de la cáscara en tres días, agranda la cámara de aire y baja de categoría en cocina. Lo recomendable en bodega de finca es sostener entre 10 °C y 15 °C y una humedad relativa del 75 % al 85 %, sin lavar el huevo con agua fría si va para comercialización en cáscara.",
          "Anotar la temperatura ambiente del cuarto de huevos durante el empaque permite detectar rápidamente si falta ventilación en horas de la tarde o si conviene cambiar los horarios de recogida en los nidos para evitar pérdidas por suciedad o picaje.",
        ],
      },
      {
        heading: "4. Separar postura apta, autoconsumo e incubación",
        paragraphs: [
          "Registrar la postura diaria tomando en cuenta el total recogido, rotos, descartados, huevos fértiles destinados a incubación y cubetas de autoconsumo familiar mantiene cuadrado el inventario disponible para venta. Al cerrar la tarde nunca habrá dudas de cuántas cubetas AA o A quedan listas para entregar temprano.",
        ],
      },
    ],
  },
  {
    slug: "registrar-en-la-finca-sin-senal",
    title: "Cómo llevar registros en la finca cuando no hay señal de internet",
    subtitle: "Por qué el papel sucio o los mensajes sueltos por WhatsApp fallan en el galpón y cómo funciona la sincronización offline-first cifrada en el celular.",
    publishedAt: "2026-11-09",
    readingMinutes: 4,
    category: "Operación en campo",
    summary:
      "La mayoría de los programas agrícolas fracasan en el campo por una razón simple: exigen señal estable justo dentro del galpón, donde el celular apenas muestra una raya de datos o solo funciona en la casa principal.",
    realFarmData: {
      label: "Dato real del gallinero piloto en Ambalá (Ibagué)",
      fact: "En recorridos de la tarde con tres corrales activos y señal intermitente, capturar recolección de huevos, alimento entregado y cierre diario desde el celular tomó en promedio 1 minuto 45 segundos en modo offline, sincronizando 14 eventos pendientes al regresar al Wi-Fi de la casa sin duplicar registros.",
    },
    image: {
      src: "/images/guia/captura-rapida-modal.webp",
      alt: "Modal de captura rápida offline-first de El Gallinero para usar sin señal",
    },
    sections: [
      {
        heading: "1. El problema del cuaderno de galpón y el doble trabajo nocturno",
        paragraphs: [
          "Muchos productores empiezan con un tablero acrílico o un cuaderno pegado en la pared del galpón. El galponero anota a lápiz los huevos y la mortalidad del día, y el propietario promete pasar esos datos al Excel el domingo en la noche. En la práctica, el papel se humedece, las notas de tres días atrás quedan ilegibles y el domingo nunca alcanza el tiempo para transcribir toda la semana.",
          "El otro extremo es pedirle al trabajador que mande audios o fotos por WhatsApp. Aunque eso resuelve el envío inmediato, a fin de mes es imposible sumar cuántos kilos de purina consumió cada corral sin volver a oír cincuenta mensajes ni perder información valiosa sobre fechas exactas.",
        ],
      },
      {
        heading: "2. Qué significa realmente offline-first y por qué importa",
        paragraphs: [
          "Una herramienta offline-first está pensada desde cero para trabajar sin conexión en el teléfono y sincronizar en segundo plano cuando aparece una red estable. En El Gallinero, basta con abrir la aplicación una vez con internet para que las pantallas principales y catálogos queden guardados localmente.",
          "Cuando entras al galpón sin señal y registras huevos, un consumo de bulto, una baja por mortalidad o un gasto menor, cada registro se guarda cifrado en el almacenamiento del navegador del celular y recibe un identificador único irrepetible de mutación.",
          "Esta arquitectura evita pantallas congeladas o formularios perdidos mientras caminas entre jaulas o corrales alejados de la antena, dando al operario la tranquilidad de que su trabajo quedó guardado al instante.",
        ],
      },
      {
        heading: "3. Botones grandes bajo sol directo y lectura de QR por estación",
        paragraphs: [
          "En el galpón no estás sentado en un escritorio con aire acondicionado: estás caminando con botas, guantes o una cubeta en la mano bajo luz solar directa. Por eso las pantallas rápidas en campo usan tipografía de alto contraste, botones mínimos de 48 píxeles de alto y cuatro pasos claros para no perder tiempo.",
          "Si pegas las etiquetas QR impresas en cada puerta de corral o bodega, el operario ni siquiera tiene que buscar de qué lote se trata en una lista larga: escanea el código de la estación con la cámara y registra directamente la recolección o novedad de ese espacio.",
        ],
      },
      {
        heading: "4. Cierre diario auditable sin duplicados al volver la señal",
        paragraphs: [
          "Al llegar nuevamente a la casa o a la carretera principal con señal 4G o Wi-Fi, la cola local envía automáticamente los eventos al servidor. Como cada movimiento lleva su comprobante de idempotencia, aunque el teléfono pierda cobertura a mitad del envío jamás duplica una venta ni descuenta dos veces el inventario de concentrado.",
          "De este modo el propietario puede consultar desde la ciudad o al final del día el estado real de la postura, las existencias de alimento y las alertas sanitarias sin perseguir reportes manuales por teléfono, y cada cierre diario queda respaldado con hora exacta y responsable asignado.",
        ],
      },
    ],
  },
  {
    slug: "compostaje-de-gallinaza",
    title: "Compostaje de gallinaza y manejo técnico de mortalidad en la granja",
    subtitle: "Cómo transformar un residuo riesgoso en abono maduro y rentable siguiendo proporciones 3:1:1, control térmico y registro sanitario sin malos olores.",
    publishedAt: "2026-11-12",
    readingMinutes: 4,
    category: "Sostenibilidad e ICA",
    summary:
      "Sacar la gallinaza cruda o botar mortalidades sin compostar atrae moscas, genera quejas con vecinos, infringe normas sanitarias y además desperdicia un ingreso extra muy valorado en huertas, pastos y cultivos de café o plátano.",
    realFarmData: {
      label: "Dato real del gallinero piloto en Ambalá (Ibagué)",
      fact: "En pilas operadas con mezcla base 3:1:1 de gallinaza, fuente de carbono seca y mortalidad con volteo programado, alcanzar temperaturas estables entre 55 °C y 62 °C durante las primeras semanas permitió cosechar abono estabilizado libre de olores fétidos y comercializar excedentes por kilogramo.",
    },
    image: {
      src: "/images/guia/produccion-gallinaza.webp",
      alt: "Gestión de pilas de compostaje de gallinaza y registros térmicos en El Gallinero",
    },
    sections: [
      {
        heading: "1. Por qué la gallinaza fresca no se debe vender ni aplicar cruda",
        paragraphs: [
          "La gallinaza recién retirada de debajo de las perchas o jaulas tiene humedad elevada, amoniaco libre y patógenos potenciales que queman las raíces de cultivos jóvenes y multiplican moscas en cuestión de días. El Decreto y las resoluciones sanitarias aplicables en Colombia, junto con las recomendaciones técnicas de AGROSAVIA y el ICA, promueven la sanitización por compostaje térmico antes de movilizar o aprovechar la pollinaza o gallinaza como enmienda agrícola.",
          "Además de evitar multas o conflictos con fincas vecinas, compostar correctamente eleva el valor comercial del producto frente a compradores de viveros, huertas orgánicas y cultivos locales.",
        ],
      },
      {
        heading: "2. Fórmula 3:1:1, humedad y curva de temperatura",
        paragraphs: [
          "Una pila funcional equilibra nitrógeno (gallinaza y eventualmente aves muertas en fosa o cajón de compostaje cerrado) con material rico en carbono seco como viruta de madera limpia, cascarilla de arroz o pasto picado seco. El punto clave está en dos mediciones sencillas: temperatura interna y prueba de humedad en el puño.",
          "Para revisar la humedad sin aparatos costosos, toma un puñado de la mezcla del centro de la pila y apriétalo fuerte: debe sentirse húmedo como una esponja escurrida, sin soltar chorros de agua ni desmoronarse seco como aserrín. Ajustar agua o cascarilla en ese momento evita problemas durante todo el ciclo.",
          "Si la pila supera los 55 °C sostenidos durante varios días dentro de la fase termofílica, se inactivan bacterias nocivas, huevos de moscas y semillas de maleza. Si la temperatura cae por debajo de lo esperado o aparece olor agrio, normalmente falta aireación por volteo o exceso de agua que sella los poros de oxígeno.",
        ],
      },
      {
        heading: "3. Control de volteos y fechas de cosecha en bodega",
        paragraphs: [
          "El mayor enemigo del compostaje no es la técnica sino olvidar cuándo tocaba el segundo volteo de la pila tres. Llevar cada cajón o pila con su código único, peso inicial de gallinaza, kilogramos de mortalidad incorporados, volumen de cascarilla y recordatorio automático del próximo volteo garantiza ciclos parejos de 35 a 45 días según el clima de la vereda.",
          "Al registrar cada cosecha de abono maduro, el inventario pasa automáticamente de kilos en proceso a kilos disponibles tanto para huerta propia (valorizado como ahorro de fertilizante en Soberanía Alimentaria) como para venta por bulto.",
        ],
      },
      {
        heading: "4. Un subproducto que paga parte del alimento y fortalece el suelo",
        paragraphs: [
          "Cuando dejas de ver el estiércol y las camas como basura y los mides en pesos por kilogramo producido, descubres que la gallinaza bien sanitizada cubre gastos mensuales recurrentes de cal, desinfectantes, energía o mantenimiento menor del galpón, cerrando el ciclo económico y ambiental de la granja.",
          "Incluso si toda la enmienda orgánica se queda en tus propios potreros, árboles frutales o huerta casera, contabilizar esos kilogramos como insumo producido en finca reduce la compra externa de fertilizantes sintéticos, mejora la retención de humedad del suelo y documenta la gestión ambiental exigida en visitas técnicas.",
        ],
      },
    ],
  },
];

export function getBitacoraArticleBySlug(slug: string): BitacoraArticle | undefined {
  return BITACORA_ARTICLES.find((a) => a.slug === slug);
}
