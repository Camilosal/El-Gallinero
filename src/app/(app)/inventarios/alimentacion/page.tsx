import {
  PageHeader,
  HeroActionButton,
  Card,
  StatCard,
} from "@/components/ui";
import { getFeedInventoryProjection } from "@/lib/feeding/inventory";
import { AlimentacionInventoryClient } from "./_components/AlimentacionInventoryClient";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction } from "@/lib/rbac";

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
  const user = await getSessionUser();
  const canSeeFinancials = canPerformAction(user?.role, "finance:read");
  const allItems = await getFeedInventoryProjection(period);

  const items = allItems.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    unit: f.unit,
    currentStock: Number(f.currentStock),
    minStock: Number(f.minStock),
    daysRemaining: f.daysRemaining,
    costPerUnit: canSeeFinancials ? Number(f.costPerUnit) : null,
    estimatedValue: canSeeFinancials ? f.estimatedValue : null,
    isLow: f.isLow,
  }));

  const totalValue = canSeeFinancials ? allItems.reduce((sum, f) => sum + f.estimatedValue, 0) : 0;
  const lowCount = allItems.filter((f) => f.isLow).length;
  const totalStock = allItems.reduce(
    (sum, f) => sum + Number(f.currentStock),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Inventario de Alimentación"
        description="Stock actual y proyección de días de alimento"
        help="Vista consolidada del inventario de alimentos. Muestra stock actual vs mínimo y días restantes proyectados según consumo reciente. Los alimentos en rojo tienen stock bajo (≤ 7 días)."
        actions={
          <form
            action="/inventarios/alimentacion"
            method="get"
            className="flex items-center gap-2"
          >
            <label
              htmlFor="days"
              className="text-xs font-medium text-emerald-50 whitespace-nowrap"
            >
              Proyección:
            </label>
            <select
              id="days"
              name="days"
              defaultValue={String(period)}
              className="min-h-[38px] border border-white/30 rounded-xl px-3 py-1.5 text-xs sm:text-[13px] font-semibold bg-white/95 text-slate-800"
            >
              {ALLOWED_PERIODS.map((days) => (
                <option key={days} value={days}>
                  {days} días
                </option>
              ))}
            </select>
            <HeroActionButton type="submit" tone="solid">
              Aplicar
            </HeroActionButton>
          </form>
        }
      />

      <div className={`grid grid-cols-2 gap-2.5 sm:gap-4 mb-6 sm:mb-8 ${canSeeFinancials ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {canSeeFinancials && <StatCard
          icon="money"
          label="Valor Total"
          value={`$${Math.round(totalValue).toLocaleString()}`}
          color="green"
        />}
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
        <AlimentacionInventoryClient items={items} initialQuery={query} canSeeFinancials={canSeeFinancials} />
      </Card>
    </div>
  );
}
