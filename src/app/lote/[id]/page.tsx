import { db } from "@/db";
import { broilerBatches, mortalityRecords } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { daysSince } from "@/lib/manure";
import { isUuid } from "@/lib/ids";
import { HeroFrame } from "@/components/HeroFrame";

export const metadata = {
  title: "Trazabilidad de lote | El Gallinero",
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
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <HeroFrame
          theme="aves"
          eyebrow="Trazabilidad pública"
          title="Trazabilidad - Sistema Gallinero"
          description="Información de producción avícola y ciclo del lote"
          className="mb-8"
          icon={
            <svg className="w-4 h-4 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* Batch Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-green-700 mb-4">
            Lote {batch.code}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Raza</p>
              <p className="text-sm font-medium text-gray-800">{batch.breed}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Fecha de inicio</p>
              <p className="text-sm font-medium text-gray-800">{batch.startDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Edad actual</p>
              <p className="text-sm font-medium text-gray-800">{ageWeeks} semanas ({ageDays} dias)</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Estado</p>
              <p className="text-sm font-medium text-gray-800">{statusLabel(batch.status)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cantidad inicial</p>
              <p className="text-sm font-medium text-gray-800">{batch.initialQuantity} aves</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cantidad actual</p>
              <p className="text-sm font-medium text-gray-800">{batch.currentQuantity} aves</p>
            </div>
            {batch.avgWeightKg && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Peso promedio</p>
                <p className="text-sm font-medium text-gray-800">{batch.avgWeightKg} kg</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Mortalidad</p>
              <p className="text-sm font-medium text-gray-800">{totalMortality} aves ({mortalityRate}%)</p>
            </div>
          </div>
        </div>

        {/* Mortality Summary */}
        {mortality.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-md font-semibold text-gray-700 mb-3">
              Registro de Mortalidad
            </h3>
            <div className="space-y-2">
              {mortality.map((m) => (
                <div key={m.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{m.date}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {m.cause.replace("_", " ")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Producto de <span className="font-semibold text-green-700">El Gallinero</span> - Granja Autosustentable
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Sistema integral de gestion avicola
          </p>
        </div>
      </div>
    </div>
  );
}
