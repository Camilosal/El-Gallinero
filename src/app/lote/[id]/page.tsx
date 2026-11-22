import { BrandLogo } from "@/components/BrandLogo";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { LegalLinksBar } from "@/components/LegalLinksBar";
import { db } from "@/db";
import { broilerBatches, mortalityRecords } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { daysSince } from "@/lib/manure";
import { isUuid } from "@/lib/ids";
import { HeroFrame } from "@/components/HeroFrame";
import { PublicNavigation } from "@/components/PublicNavigation";

export const metadata = {
  title: "Trazabilidad de lote | IwaGranja",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LoteTraceabilityPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [batch] = await db
    .select()
    .from(broilerBatches)
    .where(eq(broilerBatches.id, id));

  if (!batch) {
    notFound();
  }

  const mortality = await db
    .select({ id: mortalityRecords.id, date: mortalityRecords.date, quantity: mortalityRecords.quantity, cause: mortalityRecords.cause })
    .from(mortalityRecords)
    .where(eq(mortalityRecords.batchId, id))
    .orderBy(desc(mortalityRecords.date));

  const totalMortality = mortality.reduce((sum, m) => sum + m.quantity, 0);
  const mortalityRate =
    batch.initialQuantity > 0
      ? ((totalMortality / batch.initialQuantity) * 100).toFixed(1)
      : "0";

  const ageDays = daysSince(batch.startDate);
  const ageWeeks = Math.floor(ageDays / 7);

  const statusLabel = (s: string) => {
    switch (s) {
      case "activo": return "En crianza";
      case "listo_sacrificio": return "Listo para sacrificio";
      case "vendido": return "Vendido";
      case "faena": return "Faena";
      default: return s;
    }
  };

  return (
    <div className="bg-[var(--iw-semantic-bg-page)] min-h-screen text-[var(--iw-semantic-text-primary)]">
      <PublicNavigation sticky={false} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <HeroFrame
          theme="aves"
          eyebrow="Trazabilidad pública"
          title="Trazabilidad - IwaGranja"
          description="Información de producción avícola y ciclo del lote"
          className="mb-8"
          icon={<BrandLogo variant="mark" size={18} decorative className="rounded-sm" />}
        />

        {/* Batch Info Card */}
        <div className="bg-[var(--iw-semantic-bg-surface)] rounded-2xl shadow-[var(--iw-shadow-card)] border border-[var(--iw-semantic-border-default)] p-6 mb-6">
          <h2 className="font-display text-xl font-semibold text-[var(--iw-semantic-action-primary)] mb-4">
            Lote {batch.code}
          </h2>
          <div className="grid grid-cols-2 gap-4 tabular-nums">
            <div>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)] uppercase tracking-wide">Raza</p>
              <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{batch.breed}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)] uppercase tracking-wide">Fecha de inicio</p>
              <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{batch.startDate}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)] uppercase tracking-wide">Edad actual</p>
              <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{ageWeeks} semanas ({ageDays} dias)</p>
            </div>
            <div>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)] uppercase tracking-wide">Estado</p>
              <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{statusLabel(batch.status)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)] uppercase tracking-wide">Cantidad inicial</p>
              <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{batch.initialQuantity} aves</p>
            </div>
            <div>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)] uppercase tracking-wide">Cantidad actual</p>
              <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{batch.currentQuantity} aves</p>
            </div>
            {batch.avgWeightKg && (
              <div>
                <p className="text-xs text-[var(--iw-semantic-text-secondary)] uppercase tracking-wide">Peso promedio</p>
                <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{batch.avgWeightKg} kg</p>
              </div>
            )}
            <div>
              <p className="text-xs text-[var(--iw-semantic-text-secondary)] uppercase tracking-wide">Mortalidad</p>
              <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{totalMortality} aves ({mortalityRate}%)</p>
            </div>
          </div>
        </div>

        {/* Mortality Summary */}
        {mortality.length > 0 && (
          <div className="bg-[var(--iw-semantic-bg-surface)] rounded-2xl shadow-[var(--iw-shadow-card)] border border-[var(--iw-semantic-border-default)] p-6 mb-6">
            <h3 className="font-display text-lg font-semibold text-[var(--iw-semantic-text-primary)] mb-3">
              Registro de Mortalidad
            </h3>
            <div className="space-y-2 tabular-nums">
              {mortality.map((m) => (
                <div key={m.id} className="flex justify-between items-center py-2 border-b border-[var(--iw-semantic-border-default)]/60 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--iw-semantic-text-primary)]">{m.date}</p>
                    <p className="text-xs text-[var(--iw-semantic-text-secondary)] capitalize">
                      {m.cause.replace("_", " ")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[var(--iw-semantic-status-danger)]">{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-8 pt-6 border-t border-[var(--iw-semantic-border-default)]">
          <div className="flex justify-center mb-3">
            <BrandLogo variant="square" size={80} className="rounded-2xl bg-[var(--iw-semantic-bg-surface)] p-1.5 border border-[var(--iw-semantic-border-default)] shadow-xs" />
          </div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--iw-semantic-action-primary)]">
            IwaGranja · por Iwagé
          </p>
          <p className="text-xs text-[var(--iw-semantic-text-secondary)] mt-1">
            Gestión y trazabilidad para granjas mixtas en Colombia
          </p>
          <DeveloperCredit variant="inline" className="mt-3 justify-center" />
          <LegalLinksBar className="mt-3" />
        </footer>
      </div>
    </div>
  );
}
