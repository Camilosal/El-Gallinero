import {
  PageHeader,
  Card,
  StatCard,
} from "@/components/ui";
import { getFeedInventoryProjection } from "@/lib/feeding/inventory";
import { AlimentacionInventoryClient } from "./_components/AlimentacionInventoryClient";

export const dynamic = "force-dynamic";

const ALLOWED_PERIODS = [7, 30, 90] as const;

function resolvePeriod(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return (ALLOWED_PERIODS as readonly number[]).includes(parsed) ? parsed : 30;
}

export default async function AlimentacionInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; q?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params.days);
  const query = (params.q ?? "").trim();
  const allItems = await getFeedInventoryProjection(period);

  const items = allItems.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    unit: f.unit,
    currentStock: Number(f.currentStock),
    minStock: Number(f.minStock),
    daysRemaining: f.daysRemaining,
    costPerUnit: Number(f.costPerUnit),
    estimatedValue: f.estimatedValue,
    isLow: f.isLow,
  }));

  const totalValue = allItems.reduce((sum, f) => sum + f.estimatedValue, 0);
  const lowCount = allItems.filter((f) => f.isLow).length;
  const totalStock = allItems.reduce(
    (sum, f) => sum + Number(f.currentStock),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Inventario de Alimentación"
        description="Stock actual, valor y proyección de días de alimento"
        help="Vista consolidada del inventario de alimentos. Muestra stock actual vs mínimo, valor estimado y días restantes proyectados según consumo reciente. Los alimentos en rojo tienen stock bajo (≤ 7 días). Puedes registrar consumos y compras en Producción → Alimentación."
        actions={
          <form
            action="/dashboard/inventarios/alimentacion"
            method="get"
            className="flex items-center gap-2"
          >
            <label
              htmlFor="days"
              className="text-sm text-slate-600 whitespace-nowrap"
            >
              Proyección:
            </label>
            <select
              id="days"
              name="days"
              defaultValue={String(period)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium bg-white"
            >
              {ALLOWED_PERIODS.map((days) => (
                <option key={days} value={days}>
                  {days} días
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Aplicar
            </button>
          </form>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="money"
          label="Valor Total"
          value={`$${Math.round(totalValue).toLocaleString()}`}
          color="green"
        />
        <StatCard
          icon="package"
          label="Stock Total"
          value={`${totalStock.toFixed(1)} kg`}
          color="blue"
        />
        <StatCard
          icon="wheat"
          label="Tipos de Alimento"
          value={allItems.length}
          color="yellow"
        />
        <StatCard
          icon="warning"
          label="Stock Bajo"
          value={lowCount}
          color={lowCount > 0 ? "red" : "green"}
        />
      </div>

      <Card>
        <AlimentacionInventoryClient items={items} initialQuery={query} />
      </Card>
    </div>
  );
}
