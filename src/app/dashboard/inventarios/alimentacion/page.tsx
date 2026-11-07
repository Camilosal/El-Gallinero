import {
  PageHeader,
  Card,
  Table,
  Badge,
  StatCard,
  EmptyState,
} from "@/components/ui";
import { getFeedInventoryProjection } from "@/lib/feeding/inventory";
import { matchesTextQuery } from "@/lib/text";

export const dynamic = "force-dynamic";

const ALLOWED_PERIODS = [7, 30, 90] as const;

function resolvePeriod(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return (ALLOWED_PERIODS as readonly number[]).includes(parsed) ? parsed : 30;
}

function FeedTable({
  items,
  search,
}: {
  items: Awaited<ReturnType<typeof getFeedInventoryProjection>>;
  search: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="🌾"
        message={
          search.trim()
            ? "No hay alimentos que coincidan con la búsqueda"
            : "No hay alimentos registrados"
        }
      />
    );
  }

  return (
    <Table
      headers={[
        "Alimento",
        "Categoría",
        "Stock",
        "Mínimo",
        "Días Rest.",
        "Costo/Unidad",
        "Valor Estimado",
      ]}
    >
      {items.map((f) => (
        <tr key={f.id} className={f.isLow ? "bg-red-50" : "hover:bg-slate-50"}>
          <td className="px-4 py-3 font-medium">{f.name}</td>
          <td className="px-4 py-3 text-sm">
            <Badge
              color={
                f.category === "suplementario"
                  ? "blue"
                  : f.category === "granja_fresco"
                    ? "green"
                    : "purple"
              }
            >
              {f.category === "suplementario"
                ? "🛒 Suplementario"
                : f.category === "granja_fresco"
                  ? "🌿 Granja Fresco"
                  : "⚙️ Procesado"}
            </Badge>
          </td>
          <td className="px-4 py-3 font-semibold">
            {Number(f.currentStock).toFixed(2)} {f.unit}
          </td>
          <td className="px-4 py-3 text-sm">
            {Number(f.minStock).toFixed(2)} {f.unit}
          </td>
          <td className="px-4 py-3">
            {f.daysRemaining !== null ? (
              <Badge
                color={
                  f.daysRemaining <= 7
                    ? "red"
                    : f.daysRemaining <= 14
                      ? "yellow"
                      : "green"
                }
              >
                {f.daysRemaining} días
              </Badge>
            ) : (
              <span className="text-slate-400">∞</span>
            )}
          </td>
          <td className="px-4 py-3">
            ${Number(f.costPerUnit).toLocaleString()}
          </td>
          <td className="px-4 py-3 font-semibold text-blue-600">
            ${Math.round(f.estimatedValue).toLocaleString()}
          </td>
        </tr>
      ))}
    </Table>
  );
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

  const items = query
    ? allItems.filter((f) =>
        matchesTextQuery(query, [
          f.name,
          f.category,
          f.category === "suplementario"
            ? "suplementario comprado"
            : f.category === "granja_fresco"
              ? "granja fresco"
              : "procesado",
          f.unit,
          f.currentStock,
          f.minStock,
          f.costPerUnit,
          f.daysRemaining,
          f.isLow ? "stock bajo" : "",
        ]),
      )
    : allItems;

  const totalValue = allItems.reduce((sum, f) => sum + f.estimatedValue, 0);
  const lowCount = allItems.filter((f) => f.isLow).length;
  const totalStock = allItems.reduce(
    (sum, f) => sum + Number(f.currentStock),
    0,
  );

  return (
    <div>
      <PageHeader
        title="🌾 Inventario de Alimentación"
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
          icon="💰"
          label="Valor Total"
          value={`$${Math.round(totalValue).toLocaleString()}`}
          color="green"
        />
        <StatCard
          icon="📦"
          label="Stock Total"
          value={`${totalStock.toFixed(1)} kg`}
          color="blue"
        />
        <StatCard
          icon="🌾"
          label="Tipos de Alimento"
          value={allItems.length}
          color="yellow"
        />
        <StatCard
          icon="⚠️"
          label="Stock Bajo"
          value={lowCount}
          color={lowCount > 0 ? "red" : "green"}
        />
      </div>

      <Card>
        <form
          action="/dashboard/inventarios/alimentacion"
          method="get"
          className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="days" value={period} />
          <div className="relative w-full sm:max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              🔍
            </span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Buscar por alimento, categoría o stock..."
              aria-label="Buscar en el inventario de alimentación"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Buscar
          </button>
          {query && (
            <a
              href={`/dashboard/inventarios/alimentacion?days=${period}`}
              className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
            >
              Limpiar
            </a>
          )}
          {query && (
            <span className="text-xs text-slate-500 sm:ml-auto">
              {items.length} de {allItems.length} alimentos
            </span>
          )}
        </form>
        <FeedTable items={items} search={query} />
      </Card>
    </div>
  );
}
