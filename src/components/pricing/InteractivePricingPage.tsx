"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Egg, House, LoaderCircle, Minus, Plus, Users } from "lucide-react";
import type {
  PricingCatalogBenefit,
  PricingMatrix,
  PricingQuote,
  PricingSegment,
  PublicPricingOffer,
} from "@/lib/pricing/types";
import { getPricingPlanCardBenefits } from "@/lib/pricing/plan-card-benefits";

type QuoteInput =
  | { segment: "producer"; users: number; months: number; renewal: boolean; farmId?: string; locations: number; areasPerLocation: number; extraPlates: 0; extraTrainingPackages: 0 }
  | { segment: "aggregator"; beneficiaries: number; months: number; renewal: boolean; farmId?: string; platesPerBeneficiary: number; extraPlates: 0; extraTrainingPackages: 0 };

const COP = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const COUNT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function money(value: number): string {
  return "$" + COP.format(value);
}

function statusColor(state: PricingCatalogBenefit["availability"]["state"]): string {
  if (state === "operational") return "border-[#bed9c3] bg-[#e8f3e9] text-[#265e37]";
  if (state === "progressive") return "border-[#ead5ae] bg-[#fbf3e4] text-[#805b23]";
  if (state === "manual") return "border-[#d8d8c8] bg-[#f3f2eb] text-[#62644e]";
  return "border-[#e7c5bb] bg-[#faece7] text-[#813f30]";
}

function planName(segment: PricingSegment): string {
  return segment === "producer" ? "Productor" : "Organización";
}

function defaultProducerTerm(offer: PublicPricingOffer): number {
  return offer.producer.terms.find((term) => term.months === 6)?.months
    ?? offer.producer.terms.find((term) => term.months >= offer.producer.physicalKitMinMonths)?.months
    ?? offer.producer.terms[0]?.months
    ?? 1;
}

function quoteInputFor(segment: PricingSegment, users: number, beneficiaries: number, months: number, renewal: boolean, offer: PublicPricingOffer | null, farmId?: string): QuoteInput {
  if (segment === "producer") {
    const locationBand = offer?.producer.locationBands.find((band) => users >= band.minUsers && users <= band.maxUsers);
    return {
      segment,
      users,
      months,
      renewal,
      ...(renewal && farmId ? { farmId } : {}),
      locations: locationBand?.maxLocations ?? 1,
      areasPerLocation: offer?.producer.includedAreasPerLocation ?? 0,
      extraPlates: 0,
      extraTrainingPackages: 0,
    };
  }
  return {
    segment,
    beneficiaries,
    months,
    renewal,
    ...(renewal && farmId ? { farmId } : {}),
    platesPerBeneficiary: offer?.aggregator.assumedPlatesPerBeneficiary ?? 1,
    extraPlates: 0,
    extraTrainingPackages: 0,
  };
}

function includedSubscriptionBenefits(offer: PublicPricingOffer, quote: PricingQuote): string[] {
  const plan = quote.segment === "producer" ? "producer" : "aggregator";
  const benefits: string[] = [];
  const count = quote.segment === "producer" ? quote.users ?? 1 : quote.beneficiaries?.totalActivated ?? 0;
  const unitLabel = quote.segment === "producer" ? "por persona" : "por cuenta";

  benefits.push(quote.segment === "producer"
    ? `${COUNT.format(count)} cuentas para tu equipo, con acceso a módulos según el rol de cada persona.`
    : `Estimación para ${COUNT.format(quote.beneficiaries?.paid ?? 0)} beneficiarios pagos y ${COUNT.format(quote.beneficiaries?.bonus ?? 0)} activaciones bonificadas.`);
  benefits.push(`Gina: ${COUNT.format(quote.gina.queriesPerUser * count)} consultas al mes (${COUNT.format(quote.gina.queriesPerUser)} ${unitLabel}), hasta ${quote.gina.audiosPerUser} audios y ${quote.gina.attachmentsPerUser} adjuntos ${unitLabel}.`);

  if (quote.segment === "producer") {
    if (quote.kit.includedPlates > 0) {
      benefits.push(`Kit inicial de ${COUNT.format(quote.kit.includedPlates)} placas QR para ${COUNT.format(quote.kit.locationsIncludedNow)} ${quote.kit.locationsIncludedNow === 1 ? "localización" : "localizaciones"}.`);
    } else if (quote.renewal) {
      benefits.push("El kit físico inicial no se repite al renovar la suscripción.");
    } else if (quote.periodMonths < offer.producer.physicalKitMinMonths) {
      benefits.push(`El kit físico se incluye desde ${offer.producer.physicalKitMinMonths} meses.`);
    }
    benefits.push("Guías de campo y portal de formación disponibles.");
    benefits.push("Participación voluntaria en la red de contactos Iwagé.");
    benefits.push(quote.renewal ? "Acceso a los módulos y servicios incluidos durante el nuevo período." : "Formación digital y bienvenida virtual de inicio.");
  } else {
    benefits.push(`Activaciones bonificadas: ${COUNT.format(quote.beneficiaries?.bonus ?? 0)} sin cargo de suscripción.`);
    if (quote.renewal) {
      benefits.push("Para continuar con la misma cohorte, no se repiten la implementación, la formación inicial ni el kit QR.");
    } else if ((quote.kit.estimatedPlates ?? 0) > 0) {
      benefits.push(`Kit QR estimado: ${COUNT.format(quote.kit.estimatedPlates ?? 0)} placas para el grupo habilitado.`);
    }
    if (quote.training.includedHours > 0) {
      benefits.push(`${quote.training.includedHours} horas de formación por cohorte.`);
    }
  }

  const support = offer.catalog.benefits.find((item) => item.id === "support-channel");
  if (support) benefits.push(support.coverage[plan].summary + ".");
  return benefits;
}

export default function InteractivePricingPage() {
  const id = useId();
  const [offer, setOffer] = useState<PublicPricingOffer | null>(null);
  const [offerError, setOfferError] = useState("");
  const [matrixResult, setMatrixResult] = useState<{
    segment: PricingSegment;
    matrix: PricingMatrix | null;
    error: string;
  } | null>(null);
  const [matrixAttempt, setMatrixAttempt] = useState(0);
  const [segment, setSegment] = useState<PricingSegment>("producer");
  const [users, setUsers] = useState(1);
  const [beneficiaries, setBeneficiaries] = useState(1);
  const [months, setMonths] = useState(3);
  const [renewal, setRenewal] = useState(false);
  const [farmId, setFarmId] = useState("");
  const [renewalVerification, setRenewalVerification] = useState<{
    loading: boolean;
    farm: { id: string; name: string; planName: "Productor" | "Organización" } | null;
    error: string;
    loginRequired: boolean;
  }>({ loading: false, farm: null, error: "", loginRequired: false });
  const [quoteResult, setQuoteResult] = useState<{
    requestBody: string;
    quote: PricingQuote | null;
    error: string | null;
    loading: boolean;
  } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [checkoutState, setCheckoutState] = useState<{ loading: boolean; error: string; loginRequired: boolean }>({
    loading: false,
    error: "",
    loginRequired: false,
  });
  const checkoutReviewDialogRef = useRef<HTMLDialogElement | null>(null);
  const [checkoutReviewOpen, setCheckoutReviewOpen] = useState(false);
  const [copySelectionStatus, setCopySelectionStatus] = useState("");
  const [activeCategory, setActiveCategory] = useState("functionalities");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/pricing/offer", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as { offer?: PublicPricingOffer; error?: string };
        if (!response.ok || !data.offer) throw new Error(data.error || "No se pudieron cargar los planes.");
        setOffer(data.offer);
        setMonths(defaultProducerTerm(data.offer));
        setBeneficiaries(data.offer.aggregator.minPaidBeneficiaries);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOfferError("No pudimos mostrar los planes. Inténtalo de nuevo en un momento.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!offer) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("restorePlan") !== "1") return;

    const nextSegment: PricingSegment = params.get("segment") === "aggregator" ? "aggregator" : "producer";
    const nextTerms = nextSegment === "producer" ? offer.producer.terms : offer.aggregator.terms;
    const requestedMonths = Number(params.get("months"));
    const nextMonths = nextTerms.some((term) => term.months === requestedMonths)
      ? requestedMonths
      : nextSegment === "producer" ? defaultProducerTerm(offer) : nextTerms[0]?.months ?? 3;
    const requestedUsers = Number(params.get("users"));
    const requestedBeneficiaries = Number(params.get("beneficiaries"));
    const nextUsers = Number.isSafeInteger(requestedUsers)
      ? Math.max(1, Math.min(offer.producer.maxUsers, requestedUsers))
      : 1;
    const nextBeneficiaries = Number.isSafeInteger(requestedBeneficiaries)
      ? Math.max(offer.aggregator.minPaidBeneficiaries, Math.min(offer.aggregator.maxEstimatorBeneficiaries, requestedBeneficiaries))
      : offer.aggregator.minPaidBeneficiaries;
    const nextRenewal = params.get("renewal") === "true";
    const nextFarmId = nextRenewal ? params.get("farmId")?.trim() ?? "" : "";

    const timer = window.setTimeout(() => {
      setSegment(nextSegment);
      setUsers(nextUsers);
      setBeneficiaries(nextBeneficiaries);
      setMonths(nextMonths);
      setRenewal(nextRenewal);
      setFarmId(nextFarmId);
      setRenewalVerification({ loading: false, farm: null, error: "", loginRequired: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [offer]);

  useEffect(() => {
    if (!offer) return;
    const controller = new AbortController();
    void fetch("/api/pricing/matrix?segment=" + segment, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null) as { matrix?: PricingMatrix; error?: string } | null;
        if (!response.ok || !data?.matrix) {
          setMatrixResult({
            segment,
            matrix: null,
            error: data?.error || "No pudimos mostrar la comparación ahora. Inténtalo de nuevo más tarde.",
          });
          return;
        }
        setMatrixResult({ segment, matrix: data.matrix, error: "" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMatrixResult({
          segment,
          matrix: null,
          error: "No pudimos conectarnos para mostrar la comparación. Inténtalo de nuevo más tarde.",
        });
      });
    return () => controller.abort();
  }, [offer, segment, matrixAttempt]);

  const currentMatrixResult = matrixResult?.segment === segment ? matrixResult : null;
  const matrix = currentMatrixResult?.matrix ?? null;
  const matrixError = currentMatrixResult?.error ?? "";
  const matrixLoading = Boolean(offer && !currentMatrixResult);

  const verifiedRenewalFarm = renewalVerification.farm?.id.toLowerCase() === farmId.trim().toLowerCase()
    ? renewalVerification.farm
    : null;
  const renewalApplied = renewal && Boolean(verifiedRenewalFarm);

  const input = useMemo(
    () => quoteInputFor(segment, users, beneficiaries, months, renewalApplied, offer, verifiedRenewalFarm?.id),
    [segment, users, beneficiaries, months, renewalApplied, verifiedRenewalFarm?.id, offer],
  );
  const checkoutLoginHref = useMemo(() => {
    const returnTo = "/planes?restorePlan=1&segment=" + segment +
      "&users=" + users + "&beneficiaries=" + beneficiaries +
      "&months=" + months + "&renewal=" + renewal +
      (renewal && farmId.trim() ? "&farmId=" + encodeURIComponent(farmId.trim()) : "") + "#calculadora";
    return "/login?next=" + encodeURIComponent(returnTo);
  }, [segment, users, beneficiaries, months, renewal, farmId]);
  const requestBody = JSON.stringify(input);
  const currentResult = quoteResult?.requestBody === requestBody ? quoteResult : null;
  const quote = currentResult?.quote ?? null;
  const quoteLoading = !offer || !currentResult || currentResult.loading;
  const organizationContactHref = useMemo(() => {
    if (segment !== "aggregator" || !renewalApplied || !verifiedRenewalFarm || !quote) return "/contacto";
    const params = new URLSearchParams({
      request: "organization-renewal",
      farmId: verifiedRenewalFarm.id,
      farmName: verifiedRenewalFarm.name,
      beneficiaries: String(beneficiaries),
      months: String(months),
      amount: String(quote.totalBeforeLogisticsAndTaxCop),
    });
    return "/contacto?" + params.toString();
  }, [segment, renewalApplied, verifiedRenewalFarm, quote, beneficiaries, months]);

  useEffect(() => {
    const dialog = checkoutReviewDialogRef.current;
    if (!dialog) return;
    if (checkoutReviewOpen && !dialog.open) dialog.showModal();
    if (!checkoutReviewOpen && dialog.open) dialog.close();
  }, [checkoutReviewOpen]);

  useEffect(() => {
    if (!offer) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setQuoteResult({ requestBody, quote: null, error: null, loading: true });
      void fetch("/api/pricing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = (await response.json()) as { quote?: PricingQuote; error?: string };
          if (!response.ok || !data.quote) throw new Error(data.error || "No se pudo calcular el plan.");
          setQuoteResult({ requestBody, quote: data.quote, error: null, loading: false });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setQuoteResult({
            requestBody,
            quote: null,
            error: error instanceof Error ? error.message : "No se pudo calcular el plan.",
            loading: false,
          });
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [offer, requestBody]);

  function selectPlan(next: PricingSegment) {
    changeSegment(next);
    window.setTimeout(() => document.getElementById("calculadora")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  function changeSegment(next: PricingSegment) {
    setSegment(next);
    setRenewal(false);
    setFarmId("");
    setRenewalVerification({ loading: false, farm: null, error: "", loginRequired: false });
    setAcceptedTerms(false);
    setCheckoutState({ loading: false, error: "", loginRequired: false });
    const terms = next === "producer" ? offer?.producer.terms : offer?.aggregator.terms;
    if (terms && !terms.some((term) => term.months === months)) {
      setMonths(next === "producer" && offer ? defaultProducerTerm(offer) : terms[0]?.months ?? 1);
    }
  }

  function chooseMatrixCell(quantity: number, term: number) {
    if (segment === "producer") setUsers(quantity);
    else setBeneficiaries(quantity);
    setMonths(term);
    setAcceptedTerms(false);
    setCheckoutState({ loading: false, error: "", loginRequired: false });
  }

  function chooseQuantity(value: number) {
    if (segment === "producer") setUsers(value);
    else setBeneficiaries(value);
    setAcceptedTerms(false);
    setCheckoutState({ loading: false, error: "", loginRequired: false });
  }

  function chooseTerm(value: number) {
    setMonths(value);
    setAcceptedTerms(false);
    setCheckoutState({ loading: false, error: "", loginRequired: false });
  }

  function chooseRenewal(value: boolean) {
    setRenewal(value);
    setRenewalVerification({ loading: false, farm: null, error: "", loginRequired: false });
    if (!value) setFarmId("");
    setAcceptedTerms(false);
    setCheckoutState({ loading: false, error: "", loginRequired: false });
  }

  function openCheckoutReview() {
    if (!quote || quoteLoading || (renewal && !renewalApplied)) return;
    setAcceptedTerms(false);
    setCopySelectionStatus("");
    setCheckoutState({ loading: false, error: "", loginRequired: false });
    setCheckoutReviewOpen(true);
  }

  function closeCheckoutReview() {
    if (checkoutState.loading) return;
    setCheckoutReviewOpen(false);
    setAcceptedTerms(false);
    setCheckoutState({ loading: false, error: "", loginRequired: false });
  }

  function checkoutSelectionSummary() {
    if (!quote) return "";
    const quantity = segment === "producer"
      ? `${COUNT.format(quote.users ?? users)} ${quote.users === 1 ? "usuario" : "usuarios"}`
      : `${COUNT.format(quote.beneficiaries?.paid ?? beneficiaries)} beneficiarios pagos, ${COUNT.format(quote.beneficiaries?.bonus ?? 0)} bonificados`;
    const lines = [
      `Plan: IwaGranja ${planName(segment)}`,
      `Cantidad: ${quantity}`,
      `Duración: ${quote.periodMonths} ${quote.periodMonths === 1 ? "mes" : "meses"}`,
      `Suscripción: ${money(quote.subscription.periodTotalCop)}`,
    ];
    if (quote.implementationOnceCop > 0) lines.push(`Implementación única: ${money(quote.implementationOnceCop)}`);
    if (quote.extraPlates.totalCop > 0) lines.push(`Materiales adicionales: ${money(quote.extraPlates.totalCop)}`);
    if (quote.extraTraining.totalCop > 0) lines.push(`Formación adicional: ${money(quote.extraTraining.totalCop)}`);
    lines.push(`Total del período: ${money(quote.totalBeforeLogisticsAndTaxCop)}`);
    if (quote.subscription.combinedSavingsCop > 0) lines.push(`Ahorro aplicado: ${money(quote.subscription.combinedSavingsCop)}`);
    lines.push(`Kit y envío: ${quote.logistics.coverage}`);
    if (quote.taxes.status) lines.push(`Impuestos: ${quote.taxes.status}`);
    lines.push("El plan es prepago y no se renueva automáticamente.");
    return lines.join("\n");
  }

  async function copyCheckoutSelection() {
    const summary = checkoutSelectionSummary();
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopySelectionStatus("Selección copiada.");
    } catch {
      setCopySelectionStatus("No se pudo copiar. Puedes revisar el resumen en esta ventana.");
    }
  }

  async function verifyRenewalFarm() {
    const submittedFarmId = farmId.trim();
    if (!submittedFarmId) {
      setRenewalVerification({ loading: false, farm: null, error: "Escribe el FarmID de la granja que quieres renovar.", loginRequired: false });
      return;
    }

    setRenewalVerification({ loading: true, farm: null, error: "", loginRequired: false });
    try {
      const response = await fetch("/api/billing/renewal/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId: submittedFarmId, segment }),
      });
      const data = (await response.json()) as { farm?: { id: string; name: string; planName: "Productor" | "Organización" }; error?: string };
      if (response.status === 401) {
        setRenewalVerification({ loading: false, farm: null, error: "Inicia sesión para comprobar esta granja.", loginRequired: true });
        return;
      }
      if (!response.ok || !data.farm) {
        setRenewalVerification({
          loading: false,
          farm: null,
          error: data.error || "No pudimos confirmar ese FarmID. Revisa el dato e inténtalo otra vez.",
          loginRequired: false,
        });
        return;
      }
      setRenewalVerification({ loading: false, farm: data.farm, error: "", loginRequired: false });
      setCheckoutState({ loading: false, error: "", loginRequired: false });
    } catch {
      setRenewalVerification({ loading: false, farm: null, error: "No fue posible comprobar el FarmID. Inténtalo de nuevo.", loginRequired: false });
    }
  }

  async function startCheckout() {
    if (!quote || !offer || !acceptedTerms || segment !== "producer") return;
    if (renewal && !verifiedRenewalFarm) {
      setCheckoutState({ loading: false, error: "Verifica el FarmID de la granja antes de continuar.", loginRequired: false });
      return;
    }
    setCheckoutState({ loading: true, error: "", loginRequired: false });
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          renewal: renewalApplied,
          farmId: renewalApplied ? verifiedRenewalFarm?.id : undefined,
          acceptedTerms: true,
          acceptedPolicyVersion: offer.policyVersion,
        }),
      });
      const data = (await response.json()) as { redirectUrl?: string; error?: string; code?: string };
      if (response.status === 401) {
        setCheckoutState({
          loading: false,
          error: "Inicia sesión para continuar con el pago.",
          loginRequired: true,
        });
        return;
      }
      if (!response.ok || !data.redirectUrl) {
        setCheckoutState({
          loading: false,
          error: response.status >= 500
            ? "Ahora no es posible iniciar el pago. Inténtalo de nuevo más tarde."
            : data.code?.startsWith("RENEWAL_")
              ? data.error || "No pudimos confirmar el beneficio de renovación para esta cuenta."
              : "No pudimos iniciar el pago con esta selección. Revisa la información e inténtalo de nuevo.",
          loginRequired: false,
        });
        return;
      }
      window.location.assign(data.redirectUrl);
    } catch {
      setCheckoutState({
        loading: false,
        error: "No fue posible conectarse para abrir el pago. Inténtalo de nuevo.",
        loginRequired: false,
      });
    }
  }

  return (
    <div className="space-y-10">
      {offerError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{offerError} Recarga la página para intentarlo de nuevo.</div>}

      <section aria-labelledby={id + "-plans-heading"}>
        <div className="mx-auto mb-7 max-w-3xl text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#a56e34]">Planes y precios</p>
          <h2 id={id + "-plans-heading"} className="mt-2 font-serif text-4xl font-medium leading-tight text-[#183f31] sm:text-5xl">Elige cómo quieres crecer.</h2>
          <p className="mt-3 text-sm leading-6 text-[#718078]">Dos formas de usar IwaGranja, con herramientas adecuadas para cada escala.</p>
        </div>

        <div className="mx-auto mb-7 flex w-fit max-w-full rounded-full bg-[#e9eee7] p-1" role="group" aria-label="Grupo de planes">
          <button
            type="button"
            aria-pressed={segment === "producer"}
            aria-controls={id + "-plan-cards"}
            onClick={() => changeSegment("producer")}
            className={"min-h-11 rounded-full px-5 text-sm font-bold transition " + (segment === "producer" ? "bg-white text-[#183f31] shadow-sm" : "text-[#65766b] hover:text-[#183f31]")}
          >
            <span className="inline-flex items-center gap-2"><House className="h-4 w-4" aria-hidden="true" />Mi granja</span>
          </button>
          <button
            type="button"
            aria-pressed={segment === "aggregator"}
            aria-controls={id + "-plan-cards"}
            onClick={() => changeSegment("aggregator")}
            className={"min-h-11 rounded-full px-5 text-sm font-bold transition " + (segment === "aggregator" ? "bg-white text-[#183f31] shadow-sm" : "text-[#65766b] hover:text-[#183f31]")}
          >
            <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" aria-hidden="true" />Organizaciones y proyectos</span>
          </button>
        </div>

        <div id={id + "-plan-cards"} className="grid gap-5 md:grid-cols-2">
          {segment === "producer" ? (
            <>
              <PlanCard
                eyebrow="Para empezar"
                title="Gratis"
                description="Organiza tus primeros registros y descubre IwaGranja."
                price="$0"
                priceNote="para siempre"
                benefits={offer ? getPricingPlanCardBenefits(offer, "free") : []}
                action={<Link href="/registro" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c8d6ca] px-4 text-sm font-bold text-[#183f31] hover:bg-[#f3f6f1]">Empezar gratis <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
              />
              <PlanCard
                recommended
                eyebrow="La opción completa"
                title="Productor"
                description="Tu operación, tu equipo y tus registros en un solo lugar."
                price={offer ? money(offer.producer.userTiers[0]?.priceCop ?? 0) : "…"}
                priceNote="por usuario / mes desde"
                benefits={offer ? getPricingPlanCardBenefits(offer, "producer") : []}
                action={<button type="button" onClick={() => selectPlan("producer")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ddb47f] px-4 text-sm font-bold text-[#29352c] hover:bg-[#e9c491]">Configurar Productor <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
              />
            </>
          ) : (
            <>
              <PlanCard
                recommended
                eyebrow="Redes productivas"
                title="Organización"
                description="Conecta, forma y acompaña a todos tus beneficiarios."
                price={offer ? money(offer.aggregator.beneficiaryTiers[0]?.priceCop ?? 0) : "…"}
                priceNote="por beneficiario / mes desde"
                benefits={offer ? getPricingPlanCardBenefits(offer, "aggregator") : []}
                action={<button type="button" onClick={() => selectPlan("aggregator")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ddb47f] px-4 text-sm font-bold text-[#29352c] hover:bg-[#e9c491]">Configurar Organización <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
              />
              <PlanCard
                eyebrow="Programas especiales"
                title="A la medida"
                description="Para organizaciones que necesitan una operación diseñada para su proyecto."
                price="Hablemos"
                priceNote="de tu proyecto"
                benefits={["Diseñamos el plan según las necesidades de tu organización", "Acompañamiento durante la puesta en marcha", "Formación e indicadores acordes al proyecto", "Integraciones según los objetivos acordados"]}
                action={<Link href="/contacto" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c8d6ca] px-4 text-sm font-bold text-[#183f31] hover:bg-[#f3f6f1]">Diseñar el alcance <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
              />
            </>
          )}
        </div>

        <p className="mx-auto mt-5 max-w-4xl text-center text-xs leading-5 text-[#718078]">
            {!offer
            ? "Estamos preparando las opciones para ti."
            : segment === "producer"
              ? "Elige entre " + offer.producer.terms.map((term) => term.months + (term.months === 1 ? " mes" : " meses")).join(", ") + ". El kit inicial se incluye desde " + offer.producer.physicalKitMinMonths + " meses."
              : "Planes para grupos desde " + offer.aggregator.minPaidBeneficiaries + " beneficiarios, con permanencias de " + offer.aggregator.terms.map((term) => term.months + (term.months === 1 ? " mes" : " meses")).join(", ") + ". Nuestro equipo te acompaña en la puesta en marcha."}
        </p>
      </section>

      <section id="calculadora" aria-labelledby={id + "-calculator-heading"} className="scroll-mt-56">
        <div className="mb-5 max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#9d7852]">Tu suscripción</p>
          <h2 id={id + "-calculator-heading"} className="mt-2 font-serif text-3xl font-medium leading-tight text-[#183f31] sm:text-4xl">
            Configura {planName(segment)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#718078]">{segment === "producer" ? "Indica cuántas personas usarán IwaGranja y por cuánto tiempo." : "Elige el tamaño de tu grupo y el tiempo de permanencia."}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#d8dfd4] bg-white p-4 shadow-[0_8px_25px_rgba(24,63,49,.04)] sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0e6] text-sm font-extrabold text-[#397657]">1</span>
              <div>
                <h3 className="font-bold text-[#183f31]">{segment === "producer" ? "Usuarios de tu granja" : "Beneficiarios de tu grupo"}</h3>
                <p className="mt-1 text-xs leading-5 text-[#718078]">{segment === "producer" ? "Indica cuántas personas usarán IwaGranja." : "Indica cuántas unidades productivas quieres incluir."}</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <label htmlFor={id + "-quantity"} className="text-sm font-bold text-[#26372d]">{segment === "producer" ? "Personas en tu equipo" : "Beneficiarios pagos"}</label>
              <div className="flex h-10 items-center rounded-xl border border-[#c8d6ca] bg-[#f8faf7]">
                <button type="button" aria-label={segment === "producer" ? "Reducir personas" : "Reducir beneficiarios"} onClick={() => chooseQuantity(Math.max(segment === "producer" ? 1 : offer?.aggregator.minPaidBeneficiaries ?? 25, (segment === "producer" ? users : beneficiaries) - 1))} disabled={(segment === "producer" ? users : beneficiaries) <= (segment === "producer" ? 1 : offer?.aggregator.minPaidBeneficiaries ?? 25)} className="flex h-10 w-10 items-center justify-center rounded-l-xl text-[#397657] hover:bg-[#e8f0e6] disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                <output htmlFor={id + "-quantity"} className="min-w-10 text-center text-base font-extrabold text-[#183f31]">{COUNT.format(segment === "producer" ? users : beneficiaries)}</output>
                <button type="button" aria-label={segment === "producer" ? "Aumentar personas" : "Aumentar beneficiarios"} onClick={() => chooseQuantity(Math.min(segment === "producer" ? offer?.producer.maxUsers ?? 25 : offer?.aggregator.maxEstimatorBeneficiaries ?? 5000, (segment === "producer" ? users : beneficiaries) + 1))} disabled={(segment === "producer" ? users : beneficiaries) >= (segment === "producer" ? offer?.producer.maxUsers ?? 25 : offer?.aggregator.maxEstimatorBeneficiaries ?? 5000)} className="flex h-10 w-10 items-center justify-center rounded-r-xl text-[#397657] hover:bg-[#e8f0e6] disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </div>

            <input id={id + "-quantity"} type="range" min={segment === "producer" ? 1 : offer?.aggregator.minPaidBeneficiaries ?? 25} max={segment === "producer" ? offer?.producer.maxUsers ?? 25 : offer?.aggregator.maxEstimatorBeneficiaries ?? 5000} step={1} value={segment === "producer" ? users : beneficiaries} onChange={(event) => chooseQuantity(Number(event.target.value))} aria-label={segment === "producer" ? "Cantidad de personas en tu equipo" : "Cantidad de beneficiarios pagos"} className="mt-5 h-2 w-full cursor-pointer accent-[#397657]" disabled={!offer} />
            <div className="mt-1 flex justify-between text-[10px] text-[#89978d]"><span>{segment === "producer" ? "1 persona" : COUNT.format(offer?.aggregator.minPaidBeneficiaries ?? 25)}</span><span>{COUNT.format(segment === "producer" ? offer?.producer.maxUsers ?? 25 : offer?.aggregator.maxEstimatorBeneficiaries ?? 5000)}</span></div>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Cantidades sugeridas">
              {(segment === "producer" ? [1, 3, 5, 10, 25] : [25, 50, 150, 500]).map((value) => {
                const selected = (segment === "producer" ? users : beneficiaries) === value;
                return <button key={value} type="button" aria-pressed={selected} onClick={() => chooseQuantity(value)} className={"min-h-9 min-w-10 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#397657] " + (selected ? "border-[#578464] bg-[#e6f0e7] text-[#1f5138]" : "border-[#e2e7dd] bg-[#f8faf7] text-[#536257] hover:border-[#aebfae]")}>{COUNT.format(value)}</button>;
              })}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[#718078]">Al ampliar tu equipo, el precio por persona disminuye por tramos.</p>
          </article>

          <article className="rounded-2xl border border-[#d8dfd4] bg-white p-4 shadow-[0_8px_25px_rgba(24,63,49,.04)] sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0e6] text-sm font-extrabold text-[#397657]">2</span>
              <div>
                <h3 className="font-bold text-[#183f31]">Elige tu permanencia</h3>
                <p className="mt-1 text-xs leading-5 text-[#718078]">Los períodos más largos pueden reducir tu precio promedio.</p>
              </div>
            </div>

            <fieldset className="mt-5">
              <legend className="sr-only">Duración de la suscripción</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(segment === "producer" ? offer?.producer.terms : offer?.aggregator.terms)?.map((term) => (
                  <button key={term.months} type="button" aria-pressed={months === term.months} onClick={() => chooseTerm(term.months)} className={"min-h-[4.75rem] rounded-xl border px-2 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#397657] " + (months === term.months ? "border-[#578464] bg-[#eaf2e8] text-[#1f5138] shadow-[inset_0_0_0_1px_#578464]" : "border-[#e2e7dd] bg-white text-[#26372d] hover:border-[#aebfae]")}>
                    {term.months} {term.months === 1 ? "mes" : "meses"}
                    <span className="mt-1 block text-[10px] font-medium text-[#718078]">{term.discountPct ? `Ahorra ${term.discountPct}%` : "Precio regular"}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {(
              <div className="mt-4 rounded-xl border border-[#e7eae4] bg-[#f7f8f4] p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={renewal} onChange={(event) => chooseRenewal(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#397657]" />
                  <span>
                    <span className="block text-xs font-bold text-[#26372d]">{segment === "producer" ? "Ya tengo una suscripción y quiero renovarla" : "Ya tengo un contrato institucional y quiero renovarlo"}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-[#718078]">
                      {(segment === "producer" ? offer?.producer.renewalTerms : offer?.aggregator.renewalTerms)?.includes(months)
                        ? segment === "producer"
                          ? "La renovación recibe 5% adicional después del descuento por permanencia. Ingresa el FarmID para comprobar la granja y asociar el pago."
                          : "La renovación de la misma cohorte recibe 5% adicional después del descuento por permanencia. Sin ampliaciones, no se repiten implementación, formación inicial ni kit. Verificaremos el contrato y el tamaño del grupo con el FarmID."
                        : "El beneficio de continuidad no aplica a este plazo. Puedes comprobar el FarmID para asociar la renovación."}
                    </span>
                  </span>
                </label>

                {renewal && (
                  <div className="mt-3 border-t border-[#e2e7dd] pt-3">
                    <label htmlFor={id + "-renewal-farm-id"} className="block text-xs font-bold text-[#26372d]">FarmID de la granja</label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        id={id + "-renewal-farm-id"}
                        type="text"
                        value={farmId}
                        onChange={(event) => {
                          setFarmId(event.target.value);
                          setRenewalVerification({ loading: false, farm: null, error: "", loginRequired: false });
                          setAcceptedTerms(false);
                          setCheckoutState({ loading: false, error: "", loginRequired: false });
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={36}
                        placeholder="Pega aquí el FarmID"
                        className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#c8d6ca] bg-white px-3 text-xs text-[#26372d] outline-none focus-visible:ring-2 focus-visible:ring-[#397657]"
                      />
                      <button
                        type="button"
                        onClick={() => void verifyRenewalFarm()}
                        disabled={renewalVerification.loading || !farmId.trim()}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#aebfae] bg-white px-3 text-xs font-bold text-[#183f31] hover:bg-[#eaf2e8] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {renewalVerification.loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                        Comprobar FarmID
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-[#718078]">Lo encuentras en Inicio, en la opción «Copiar FarmID».</p>
                    {verifiedRenewalFarm && <p role="status" className="mt-2 text-[11px] font-semibold text-[#2d7045]">{verifiedRenewalFarm.planName === "Organización" ? "Contrato institucional confirmado" : "Granja confirmada"}: {verifiedRenewalFarm.name}. {renewalApplied && (offer?.[segment].renewalTerms.includes(months) ? "El cálculo incluye 5% por continuidad." : "La renovación quedó asociada, pero este plazo no recibe el descuento de continuidad.")} </p>}
                    {renewalVerification.error && (
                      <p role="alert" className="mt-2 text-[11px] leading-5 text-[#813f30]">
                        {renewalVerification.error}{renewalVerification.loginRequired && <> <Link href={checkoutLoginHref} className="font-bold underline underline-offset-2">Iniciar sesión</Link></>}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </article>
        </div>

        <aside aria-live="polite" aria-busy={quoteLoading} className="mt-4 rounded-3xl bg-[radial-gradient(ellipse_at_top_right,#305a45_0%,transparent_48%),linear-gradient(145deg,#1e4735,#102c21)] p-5 text-white shadow-[0_18px_55px_rgba(24,63,49,.12)] sm:p-7">
          {quoteLoading && <div className="flex items-center gap-2 text-sm text-[#d0e1d2]"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Actualizando el resumen de tu suscripción…</div>}
          {currentResult?.error && <p role="alert" className="rounded-xl bg-white/10 p-3 text-sm text-white">{currentResult.error}</p>}
          {quote && (
            <>
              <div className="grid gap-5 md:grid-cols-[.9fr_1.1fr]">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#b7d0b8]">Tu suscripción {planName(segment)}</p>
                  <p className="mt-3 text-xs text-[#c9d8cb]">Total prepago por {quote.periodMonths} {quote.periodMonths === 1 ? "mes" : "meses"}</p>
                  <p className="mt-1 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl">{money(quote.totalBeforeLogisticsAndTaxCop)}</p>
                  <p className="mt-2 text-sm font-semibold text-[#f2d5a4]">{money(quote.subscription.effectiveUnitMonthlyCop)} por {segment === "producer" ? "persona" : "beneficiario habilitado"} al mes</p>
                  <p className="mt-1 text-xs text-[#d0e1d2]">Suscripción: {money(quote.subscription.monthlyEquivalentCop)} al mes · sin renovación automática.</p>
                  {quote.implementationOnceCop > 0 && <p className="mt-2 text-xs text-[#f2d5a4]">Incluye implementación única de {money(quote.implementationOnceCop)}.</p>}

                  <div className="mt-4 space-y-2 border-t border-white/15 pt-3 text-xs leading-5 text-[#d0e1d2]">
                    <p><strong className="text-white">Ahorro por cantidad:</strong> {money(quote.subscription.volumeSavingsCop)} en el período · {money(quote.subscription.volumeAdjustedMonthlyCop)}/mes antes del descuento por permanencia.</p>
                    <p><strong className="text-white">Ahorro por permanencia:</strong> {money(quote.subscription.durationSavingsCop)} · {quote.subscription.durationDiscountPct}% aplicado después del precio por cantidad.</p>
                    {quote.subscription.loyaltySavingsCop > 0 && <p><strong className="text-white">{segment === "producer" ? "Beneficio de renovación" : "Beneficio de continuidad"}:</strong> {money(quote.subscription.loyaltySavingsCop)} adicional ({quote.subscription.loyaltyDiscountPct}%).</p>}
                    <p className="font-semibold text-[#f2d5a4]">Ahorro combinado: {money(quote.subscription.combinedSavingsCop)} ({quote.subscription.combinedSavingsPct.toLocaleString("es-CO", { maximumFractionDigits: 2 })}%) frente a {money(quote.subscription.baseReferencePeriodTotalCop)}.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/[.06] p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-white">En esta suscripción recibes</h3>
                  <ul className="mt-3 space-y-2.5 text-xs leading-5 text-[#e1ece2]">
                    {includedSubscriptionBenefits(offer!, quote).map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#c2d9b7]" aria-hidden="true" /><span>{item}</span></li>)}
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#c2d9b7]" aria-hidden="true" /><span>{quote.logistics.coverage}</span></li>
                    {quote.taxes.status && <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#c2d9b7]" aria-hidden="true" /><span>{quote.taxes.status}</span></li>}
                  </ul>
                  <Link href="#explorador-de-alcances" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#f2d5a4] underline underline-offset-4">Revisar alcance y exclusiones <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
                </div>
              </div>

              {segment === "producer" ? (
                <div className="mt-5 border-t border-white/15 pt-4">
                  <button type="button" onClick={openCheckoutReview} disabled={!quote || quoteLoading || checkoutState.loading || (renewal && !renewalApplied)} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#edc993] px-4 text-sm font-extrabold text-[#183f31] transition hover:bg-[#f5d7a8] disabled:cursor-not-allowed disabled:opacity-55">
                    Continuar con Productor <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <p className="mt-2 text-center text-[10px] leading-4 text-[#c9d8cb]">Antes de iniciar el pago podrás revisar el importe, los beneficios y las condiciones de tu suscripción.</p>
                </div>
              ) : (
                <div className="mt-5 border-t border-white/15 pt-4">
                  <p className="text-xs leading-5 text-[#d0e1d2]">{renewal ? renewalApplied ? "El equipo revisará el contrato y el tamaño de la cohorte antes de confirmar la renovación." : "Comprueba el FarmID para validar el contrato y asociar la solicitud de renovación." : "Nuestro equipo te ayudará a concretar la activación de tu grupo."}</p>
                  {renewal && !renewalApplied ? (
                    <button type="button" disabled className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#edc993]/60 px-4 text-sm font-bold text-[#183f31]/70">Comprueba el FarmID para continuar</button>
                  ) : (
                    <Link href={organizationContactHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#edc993] px-4 text-sm font-bold text-[#183f31] hover:bg-[#f5d7a8]">{renewalApplied ? "Solicitar renovación de Organización" : "Solicitar activación de Organización"} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                  )}
                </div>
              )}
            </>
          )}
          {!quote && !quoteLoading && !currentResult?.error && <p role="alert" className="text-sm text-[#e1ece2]">No pudimos actualizar el precio. Inténtalo de nuevo.</p>}
        </aside>
      </section>

      {offer && (
        <section aria-labelledby={id + "-matrix-heading"} className="rounded-2xl border border-[#d8dfd4] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#9d7852]">Compara antes de elegir</p>
              <h2 id={id + "-matrix-heading"} className="mt-1 font-serif text-2xl font-medium text-[#183f31]">Cantidad × duración</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[#718078]">Selecciona una celda para aplicar esa opción al resumen. Los importes corresponden a la suscripción prepaga; la implementación se muestra aparte.</p>
            </div>
            {matrixLoading && <LoaderCircle className="h-5 w-5 animate-spin text-[#397657]" aria-label="Cargando matriz" />}
          </div>
          {matrixError && (
            <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#faece7] p-3 text-sm text-[#813f30]">
              <span>{matrixError}</span>
              <button type="button" onClick={() => { setMatrixResult(null); setMatrixAttempt((attempt) => attempt + 1); }} className="min-h-9 rounded-lg border border-[#c98e7f] px-3 text-xs font-bold hover:bg-white/60">Intentar de nuevo</button>
            </div>
          )}
          {matrix && matrix.segment === segment && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#e5e7df]" aria-busy={matrixLoading}>
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <caption className="sr-only">Comparación interactiva de cantidad y plazo para {segment === "producer" ? "usuarios" : "beneficiarios"}</caption>
                <thead className="bg-[#f1f5ef] text-[#314638]">
                  <tr>
                    <th scope="col" className="p-3">{segment === "producer" ? "Usuarios" : "Beneficiarios pagos"}</th>
                    {matrix.terms.map((term) => <th scope="col" key={term.months} className="p-3">{term.months} {term.months === 1 ? "mes" : "meses"}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.quantityOptions.map((quantity) => (
                    <tr key={quantity} className="border-t border-[#e5e7df]">
                      <th scope="row" className="whitespace-nowrap p-3 font-bold text-[#26372d]">{COUNT.format(quantity)} {segment === "producer" ? "usuarios" : "pagos"}</th>
                      {matrix.terms.map((term) => {
                        const cell = matrix.cells.find((item) => item.quantity === quantity && item.months === term.months);
                        if (!cell) return <td key={term.months} className="p-2">—</td>;
                        const selected = (segment === "producer" ? users : beneficiaries) === quantity && months === term.months;
                        return (
                          <td key={term.months} className="min-w-[150px] p-2">
                            <button type="button" aria-pressed={selected} onClick={() => chooseMatrixCell(quantity, term.months)} className={"min-h-[5.5rem] w-full rounded-lg border p-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#397657] " + (selected ? "border-[#578464] bg-[#e6f0e7] text-[#1f5138] shadow-[inset_0_0_0_1px_#578464]" : "border-[#e7eae4] bg-white text-[#536257] hover:border-[#aebfae]")}>
                              <span className="block font-bold">{money(cell.effectiveUnitMonthlyCop)} / {segment === "producer" ? "usuario" : "beneficiario habilitado"} / mes</span>
                              <span className="mt-1 block text-[10px]">Prepago: {money(cell.subscriptionTotalCop)}</span>
                              {segment === "aggregator" && <span className="mt-1 block text-[10px]">+ {COUNT.format(cell.bonusActivations ?? 0)} bonificados = {COUNT.format(cell.totalActivated ?? quantity)} activados</span>}
                              <span className="mt-1 block text-[10px]">Ahorro: {money(cell.combinedSavingsCop)} ({cell.combinedSavingsPct.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%)</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {offer && (
        <>
          <details className="group rounded-2xl border border-[#d8dfd4] bg-white p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-xl font-medium text-[#183f31]">
              Comparar planes
              <span className="text-sm font-bold text-[#718078] group-open:hidden">Ver comparación</span>
              <span className="hidden text-sm font-bold text-[#718078] group-open:inline">Ocultar</span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-[#718078]">Consulta en una sola vista las diferencias de cobertura, límites y disponibilidad.</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#e5e7df]">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <caption className="sr-only">Comparación de planes Gratis, Productor y Organización</caption>
                <thead className="bg-[#f1f5ef] text-[#314638]">
                  <tr><th scope="col" className="w-[26%] p-3">Prestación</th><th scope="col" className="p-3">Gratis</th><th scope="col" className="p-3">Productor</th><th scope="col" className="p-3">Organización</th></tr>
                </thead>
                <tbody>
                  {offer.catalog.benefits.map((item) => (
                    <tr key={item.id} className="border-t border-[#e5e7df] align-top">
                      <th scope="row" className="p-3 font-semibold text-[#26372d]">{item.name}<p className="mt-1 font-normal leading-5 text-[#718078]">{item.availability.label}</p></th>
                      {(["free", "producer", "aggregator"] as const).map((plan) => (
                        <td key={plan} className="p-3 text-[#536257]">
                          <p>{item.coverage[plan].summary}</p>
                          {item.coverage[plan].limits.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-[#718078]">{item.coverage[plan].limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>}
                          <p className="mt-2 text-[#718078]">Periodicidad: {item.coverage[plan].frequency}</p>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details id="explorador-de-alcances" className="group rounded-2xl border border-[#d8dfd4] bg-white p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-xl font-medium text-[#183f31]">
              Explorador de alcances
              <span className="text-sm font-bold text-[#718078] group-open:hidden">Ver prestaciones</span>
              <span className="hidden text-sm font-bold text-[#718078] group-open:inline">Ocultar</span>
            </summary>
            <div className="mt-5">
              <h2 className="font-serif text-2xl font-medium text-[#183f31]">Qué incluye cada prestación</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#718078]">Una ficha por prestación: unidad, disponibilidad real, exclusiones y servicios adicionales.</p>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Categorías de prestaciones">
                {offer.catalog.categories.map((category) => (
                  <button key={category.id} type="button" aria-pressed={activeCategory === category.id} aria-controls={id + "-category-panel"} onClick={() => setActiveCategory(category.id)} className={"min-h-10 shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition " + (activeCategory === category.id ? "border-[#183f31] bg-[#183f31] text-white" : "border-[#d8dfd4] bg-white text-[#536257] hover:border-[#72937a]")}>{category.label}</button>
                ))}
              </div>
              {offer.catalog.categories.filter((category) => category.id === activeCategory).map((category) => (
                <div key={category.id} id={id + "-category-panel"} aria-live="polite" className="mt-3">
                  <p className="mb-3 text-sm text-[#718078]">{category.description}</p>
                  <div className="space-y-3">
                    {offer.catalog.benefits.filter((item) => item.category === category.id).map((item) => (
                      <article key={item.id} className="rounded-2xl border border-[#e2e7dd] bg-white p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-[#26372d]">{item.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-[#718078]">{item.description}</p>
                          </div>
                          <span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold " + statusColor(item.availability.state)}>{item.availability.label}</span>
                        </div>
                        <dl className="mt-3 space-y-2 border-t border-[#e5e7df] pt-3 text-xs leading-5">
                          <div><dt className="font-bold text-[#526456]">Unidad</dt><dd className="text-[#718078]">{item.unit}</dd></div>
                          <div><dt className="font-bold text-[#526456]">Disponibilidad</dt><dd className="text-[#718078]">{item.availability.detail}</dd></div>
                          <div><dt className="font-bold text-[#526456]">Exclusiones</dt><dd className="text-[#718078]">{item.exclusions.length ? item.exclusions.join(" ") : "No se han declarado exclusiones adicionales."}</dd></div>
                          <div><dt className="font-bold text-[#526456]">Servicios adicionales</dt><dd className="text-[#718078]">{item.addOns.length ? item.addOns.join(" ") : "No definidos."}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}

      <p className="text-center text-xs leading-5 text-[#718078]">Catálogo {offer?.catalog.version ?? "…"} · Política {offer?.policyVersion ?? "…"}. Las condiciones vigentes se revisan antes de iniciar un pago.</p>

      <dialog
        ref={checkoutReviewDialogRef}
        className="pricing-review-dialog"
        aria-labelledby={id + "-review-title"}
        aria-describedby={id + "-review-description"}
        onCancel={(event) => {
          if (checkoutState.loading) event.preventDefault();
          else closeCheckoutReview();
        }}
        onClick={(event) => {
          if (event.target === checkoutReviewDialogRef.current) closeCheckoutReview();
        }}
      >
        {quote && (
          <div>
            <header className="pricing-review-header">
              <div>
                <p>Último paso</p>
                <h2 id={id + "-review-title"}>Revisa tu suscripción</h2>
              </div>
              <button
                type="button"
                onClick={closeCheckoutReview}
                disabled={checkoutState.loading}
                aria-label="Cerrar resumen de la suscripción"
                className="pricing-review-close"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="pricing-review-content">
              <p id={id + "-review-description"} className="text-sm leading-6 text-[#718078]">
                Comprueba el alcance que elegiste antes de continuar.
              </p>

              <dl className="pricing-review-summary">
                <div><dt>Plan</dt><dd>IwaGranja {planName(segment)}</dd></div>
                <div>
                  <dt>Cantidad</dt>
                  <dd>
                    {segment === "producer"
                      ? `${COUNT.format(quote.users ?? users)} ${quote.users === 1 ? "usuario" : "usuarios"}`
                      : <>{COUNT.format(quote.beneficiaries?.paid ?? beneficiaries)} beneficiarios pagos · {COUNT.format(quote.beneficiaries?.bonus ?? 0)} bonificados · {COUNT.format(quote.beneficiaries?.totalActivated ?? beneficiaries)} activados</>}
                  </dd>
                </div>
                <div><dt>Duración</dt><dd>{quote.periodMonths} {quote.periodMonths === 1 ? "mes" : "meses"}</dd></div>
                <div><dt>Suscripción</dt><dd>{money(quote.subscription.periodTotalCop)}</dd></div>
                {quote.implementationOnceCop > 0 && <div><dt>Implementación única</dt><dd>{money(quote.implementationOnceCop)}</dd></div>}
                {quote.extraPlates.totalCop > 0 && <div><dt>Materiales adicionales</dt><dd>{money(quote.extraPlates.totalCop)}</dd></div>}
                {quote.extraTraining.totalCop > 0 && <div><dt>Formación adicional</dt><dd>{money(quote.extraTraining.totalCop)}</dd></div>}
                {quote.subscription.combinedSavingsCop > 0 && <div className="pricing-review-savings"><dt>Ahorro aplicado</dt><dd>−{money(quote.subscription.combinedSavingsCop)}</dd></div>}
                <div className="pricing-review-total"><dt>TOTAL DEL PERÍODO</dt><dd>{money(quote.totalBeforeLogisticsAndTaxCop)}</dd></div>
              </dl>

              <section className="pricing-review-conditions" aria-labelledby={id + "-review-conditions"}>
                <h3 id={id + "-review-conditions"}>Antes del cobro</h3>
                <p>
                  El período se paga por anticipado y no se renueva automáticamente. {renewal && verifiedRenewalFarm
                    ? quote.subscription.loyaltyDiscountPct > 0
                      ? `Granja validada: ${verifiedRenewalFarm.name}. El beneficio de continuidad elegible ya está incluido en el cálculo.`
                      : `Granja validada: ${verifiedRenewalFarm.name}. Este plazo no incluye descuento de continuidad.`
                  : "Revisaremos la cuenta antes de iniciar el pago."} El total mostrado es el que se enviará al pago. La cobertura del kit aparece abajo; cualquier envío extraordinario se confirma antes de contratar.
                </p>
                <div className="pricing-review-detail">
                  <strong>Kit y envío</strong>
                  <span>{quote.logistics.coverage}</span>
                </div>
                {quote.taxes.status && (
                  <div className="pricing-review-detail">
                    <strong>Impuestos</strong>
                    <span>{quote.taxes.status}</span>
                  </div>
                )}
              </section>

              <label className="pricing-review-acceptance">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => {
                    setAcceptedTerms(event.target.checked);
                    setCheckoutState({ loading: false, error: "", loginRequired: false });
                  }}
                />
                <span>
                  He revisado el alcance y el total. Acepto los <Link href="/terminos" target="_blank">términos</Link> y la <Link href="/retracto" target="_blank">política de retracto</Link>, y comprendo que cualquier envío extraordinario se confirma antes de contratarlo.
                </span>
              </label>

              {checkoutState.error && (
                <p role="alert" className="pricing-review-error">
                  {checkoutState.error}{checkoutState.loginRequired && <> <Link href={checkoutLoginHref} className="font-bold underline underline-offset-2">Iniciar sesión</Link></>}
                </p>
              )}

              <div className="pricing-review-actions">
                <button type="button" onClick={() => void copyCheckoutSelection()} className="pricing-review-copy">
                  Copiar mi selección
                </button>
                <button
                  type="button"
                  onClick={() => void startCheckout()}
                  disabled={!acceptedTerms || !quote || checkoutState.loading || (renewal && !renewalApplied)}
                  className="pricing-review-continue"
                >
                  {checkoutState.loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Continuar a registro y pago <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p role="status" aria-live="polite" className="pricing-review-copy-status">{copySelectionStatus}</p>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function PlanCard({
  eyebrow,
  title,
  description,
  price,
  priceNote,
  benefits,
  action,
  recommended = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  price: string;
  priceNote: string;
  benefits: string[];
  action: ReactNode;
  recommended?: boolean;
}) {
  return (
    <article className={"relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-[0_12px_35px_rgba(24,63,49,.05)] sm:p-8 " + (recommended ? "border-[#b8d2bd] bg-[#fbfcf8]" : "border-[#e5e7df]")}>
      <div className="flex min-h-6 items-start justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#a56e34]">{eyebrow}</p>
        {recommended && <span className="rounded-full bg-[#dfeadd] px-3 py-1 text-[9px] font-extrabold uppercase tracking-wide text-[#23523a]">Recomendado</span>}
      </div>
      <h3 className="mt-3 font-serif text-3xl font-medium text-[#183f31]">{title}</h3>
      <p className="mt-1 min-h-12 text-sm leading-6 text-[#718078]">{description}</p>
      <div className="mt-5 flex min-h-12 flex-wrap items-baseline gap-x-2">
        <span className="font-serif text-4xl font-bold tracking-tight text-[#183f31]">{price}</span>
        <span className="text-xs text-[#718078]">{priceNote}</span>
      </div>
      <div className="mt-4">{action}</div>
      <ul className="mt-5 flex-1 space-y-2.5 border-t border-[#e5e7df] pt-5 text-sm leading-5 text-[#536257]">
        {benefits.map((benefit, index) => (
          <li key={index} className="flex items-start gap-2.5">
            {title === "A la medida" ? <Egg className="mt-0.5 h-4 w-4 shrink-0 text-[#397657]" aria-hidden="true" /> : <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#397657]" aria-hidden="true" />}
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
