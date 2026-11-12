"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, BarChart3, CheckCircle2, QrCode } from "lucide-react";
import EntityQrModal from "@/components/EntityQrModal";
import { apiFetch } from "@/lib/fetch";
import { PageHeader, StatCard, Card, Button, Input, Select, Textarea, Badge, Modal, Table, EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { isRoosterPresent } from "@/lib/animal-status";
import { getBreedsForSpecies, normalizeManagedSpecies, type ManagedAnimalSpecies } from "@/lib/animal-breeds";
import { useCatalog } from "@/lib/useCatalog";
import {
  calcularRentabilidadLote,
  SPECIES_ICON,
  SPECIES_LABEL,
} from "@/lib/species-params";
import { useSpeciesCatalog } from "@/lib/use-species-params";

interface Rooster {
  id: string;
  code: string;
  breed: string;
  birthDate: string;
  status: string;
  weight: string | null;
  notes: string | null;
  ageWeeks: number;
}

interface Batch {
  id: string;
  code: string;
  species: string;
  purpose?: string | null;
  systemType?: string | null;
  breed: string;
  startDate: string;
  initialQuantity: number;
  currentQuantity: number;
  targetWeeks: number;
  targetDays?: number | null;
  targetWeightKg: string;
  avgWeightKg: string | null;
  feedConversionTarget?: string | null;
  status: string;
  notes: string | null;
  ageWeeks: number;
  readinessReasons: string[];
}

interface FlockBalance {
  required: number;
  active: number;
  deficit: number;
  surplus: number;
}

const roosterStatusLabels: Record<string, { label: string; color: string }> = {
  activo: { label: "Activo", color: "green" },
  enfermo: { label: "Enfermo", color: "yellow" },
  vendido: { label: "Vendido", color: "blue" },
  faena: { label: "Faena", color: "orange" },
  muerto: { label: "Muerto", color: "gray" },
};

const batchStatusLabels: Record<string, { label: string; color: string }> = {
  activo: { label: "En crianza", color: "green" },
  listo_sacrificio: { label: "Listo sacrificio", color: "orange" },
  vendido: { label: "Vendido", color: "blue" },
  faena: { label: "Faena", color: "gray" },
};

const purposeLabels: Record<string, string> = {
  engorde_carne: "Engorde carne",
  postura_huevo: "Postura huevo",
  pie_cria: "Pie de cría",
  mixto: "Doble propósito",
};

const systemTypeLabels: Record<string, string> = {
  piso: "Galpón / Piso",
  pastoreo: "Pastoreo / Campero",
  jaulas: "Jaulas",
  baterias: "Baterías verticales",
};

type Tab = "gallos" | "lotes";

export default function PollosPage({ embedded = false, initialTab, initialSpeciesFilter = "all" }: { embedded?: boolean; initialTab?: Tab; initialSpeciesFilter?: string } = {}) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab || (searchParams.get("subtab") === "lotes" ? "lotes" : "gallos"));
  const [qrBatch, setQrBatch] = useState<Batch | null>(null);
  const { getParams } = useSpeciesCatalog();
  const { items: breedCatalog } = useCatalog("raza", []);

  // ─── Gallos state ───
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [balance, setBalance] = useState<FlockBalance | null>(null);
  const [roosterModalOpen, setRoosterModalOpen] = useState(false);
  const [editingRooster, setEditingRooster] = useState<Rooster | null>(null);
  const [roosterError, setRoosterError] = useState("");
  const [roosterForm, setRoosterForm] = useState({
    code: "",
    breed: "",
    birthDate: new Date().toISOString().split("T")[0],
    status: "activo",
    weight: "",
    notes: "",
  });

  // ─── Lotes state ───
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchError, setBatchError] = useState("");
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>(initialSpeciesFilter);

  const [batchForm, setBatchForm] = useState({
    code: "",
    species: "pollo",
    purpose: "engorde_carne",
    systemType: "piso",
    breed: "Cobb 500 / Ross 308",
    startDate: new Date().toISOString().split("T")[0],
    initialQuantity: "20",
    currentQuantity: "",
    targetWeeks: "7",
    targetDays: "49",
    targetWeightKg: "2.5",
    avgWeightKg: "",
    feedConversionTarget: "1.9",
    status: "activo",
    notes: "",
    acquisitionCostEst: "0",
    headsAutoconsumoEst: "4",
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const roosterBreedOptions = getBreedsForSpecies(breedCatalog, "gallina", editingRooster ? roosterForm.breed : null);
  const batchBreedSpecies = normalizeManagedSpecies(batchForm.species) || "pollo";
  const batchBreedOptions = getBreedsForSpecies(breedCatalog, batchBreedSpecies as ManagedAnimalSpecies, editingBatch ? batchForm.breed : null);

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/gallos").then((r) => (r.ok ? r.json() : [])),
      apiFetch("/api/produccion/pollos").then((r) => (r.ok ? r.json() : [])),
      apiFetch("/api/dashboard").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([gallosData, lotesData, dashboard]) => {
      setRoosters(Array.isArray(gallosData) ? gallosData : []);
      setBalance(dashboard?.roosters || null);
      setBatches(Array.isArray(lotesData) ? lotesData : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Al cambiar de especie en el formulario de lote, auto-rellenar valores de referencia
  const handleSpeciesChange = (species: string) => {
    const p = getParams(species);
    const associatedSpecies = normalizeManagedSpecies(species) || "pollo";
    const firstBreed = getBreedsForSpecies(breedCatalog, associatedSpecies)[0] || p?.breed || "";
    if (!p) {
      setBatchForm((prev) => ({ ...prev, species, breed: firstBreed }));
      return;
    }
    const qty = Number(batchForm.initialQuantity) || 20;
    const autoConsumoSugg = Math.max(1, Math.round(qty * 0.25));

    setBatchForm((prev) => ({
      ...prev,
      species,
      breed: firstBreed,
      targetWeeks: String(p.cycleWeeks),
      targetDays: String(p.cycleDays),
      targetWeightKg: String(p.targetWeightKg),
      systemType: p.systemType,
      feedConversionTarget: String(p.feedConversionRatio),
      headsAutoconsumoEst: String(autoConsumoSugg),
    }));
  };

  // ─── Gallos CRUD ───
  const openEditRooster = (r: Rooster) => {
    setEditingRooster(r);
    setRoosterError("");
    setRoosterForm({ code: r.code, breed: r.breed, birthDate: r.birthDate, status: r.status, weight: r.weight || "", notes: r.notes || "" });
    setRoosterModalOpen(true);
  };

  const saveRooster = async () => {
    setRoosterError("");
    if (!editingRooster) { setRoosterError("Las altas nuevas deben registrarse desde Adquisiciones"); return; }
    if (!roosterForm.breed) { setRoosterError("Raza requerida"); return; }
    if (!roosterForm.birthDate) { setRoosterError("Fecha de nacimiento requerida"); return; }

    const payload: Record<string, unknown> = {
      code: roosterForm.code || undefined,
      breed: roosterForm.breed,
      birthDate: roosterForm.birthDate,
      status: roosterForm.status,
      weight: roosterForm.weight || null,
      notes: roosterForm.notes || null,
    };
    payload.id = editingRooster.id;

    const res = await apiFetch("/api/produccion/gallos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setRoosterError(data.error || "Error al guardar"); return; }
    setRoosterModalOpen(false);
    load();
  };

  const removeRooster = async (id: string) => {
    if (!confirm("¿Eliminar este gallo?")) return;
    const res = await apiFetch(`/api/produccion/gallos?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo eliminar el gallo");
      return;
    }
    load();
  };

  // ─── Lotes CRUD ───
  const openEditBatch = (b: Batch) => {
    setEditingBatch(b);
    setBatchError("");
    const species = b.species || "pollo";
    const p = getParams(species);
    setBatchForm({
      code: b.code,
      species,
      purpose: b.purpose || "engorde_carne",
      systemType: b.systemType || (p?.systemType || "piso"),
      breed: b.breed,
      startDate: b.startDate,
      initialQuantity: String(b.initialQuantity),
      currentQuantity: String(b.currentQuantity),
      targetWeeks: String(b.targetWeeks),
      targetDays: String(b.targetDays || b.targetWeeks * 7),
      targetWeightKg: b.targetWeightKg,
      avgWeightKg: b.avgWeightKg || "",
      feedConversionTarget: b.feedConversionTarget || (p ? String(p.feedConversionRatio) : ""),
      status: b.status,
      notes: b.notes || "",
      acquisitionCostEst: "0",
      headsAutoconsumoEst: "0",
    });
    setBatchModalOpen(true);
  };

  const saveBatch = async () => {
    setBatchError("");
    if (!editingBatch) { setBatchError("Las altas nuevas deben registrarse desde Adquisiciones"); return; }
    if (!batchForm.breed) { setBatchError("Raza requerida"); return; }
    const initialQty = Number(batchForm.initialQuantity);
    if (!initialQty || initialQty < 1) { setBatchError("Cantidad inicial inválida"); return; }
    const currentQty = batchForm.currentQuantity ? Number(batchForm.currentQuantity) : initialQty;
    if (currentQty < 0 || currentQty > initialQty) { setBatchError("La cantidad actual debe estar entre 0 y la cantidad inicial"); return; }

    const targetWeeks = Number(batchForm.targetWeeks) || 7;
    const targetDays = batchForm.targetDays ? Number(batchForm.targetDays) : targetWeeks * 7;

    const payload: Record<string, unknown> = {
      code: batchForm.code || undefined,
      species: batchForm.species,
      purpose: batchForm.purpose,
      systemType: batchForm.systemType,
      breed: batchForm.breed,
      startDate: batchForm.startDate,
      initialQuantity: initialQty,
      currentQuantity: currentQty,
      targetWeeks,
      targetDays,
      targetWeightKg: batchForm.targetWeightKg || "2.5",
      avgWeightKg: batchForm.avgWeightKg || null,
      feedConversionTarget: batchForm.feedConversionTarget || null,
      status: batchForm.status,
      notes: batchForm.notes || null,
    };
    payload.id = editingBatch.id;

    const res = await apiFetch("/api/produccion/pollos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setBatchError(data.error || "Error al guardar"); return; }
    setBatchModalOpen(false);
    load();
  };

  const removeBatch = async (id: string) => {
    if (!confirm("¿Eliminar este lote? Se eliminarán también las ventas y sacrificios asociados.")) return;
    const res = await apiFetch(`/api/produccion/pollos?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo eliminar el lote");
      return;
    }
    load();
  };

  // ─── Stats ───
  const activeRoosters = roosters.filter((r) => isRoosterPresent(r.status)).length;
  const totalInBatches = batches.reduce((s, b) => s + b.currentQuantity, 0);
  const readyBatches = batches.filter((b) => b.status === "listo_sacrificio");

  // Conteo de animales por especie en lotes activos
  const animalsBySpecies = useMemo(() => {
    const map: Record<string, number> = { pollo: 0, codorniz: 0, pato: 0, conejo: 0 };
    batches.forEach((b) => {
      const sp = b.species || "pollo";
      map[sp] = (map[sp] || 0) + b.currentQuantity;
    });
    return map;
  }, [batches]);

  const filteredRoosters = useMemo(() => {
    if (!search.trim()) return roosters;
    return roosters.filter((r) =>
      matchesTextQuery(search, [
        r.code,
        r.breed,
        r.status,
        roosterStatusLabels[r.status]?.label,
        r.weight,
        r.notes,
      ]),
    );
  }, [roosters, search]);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const sp = b.species || "pollo";
      if (selectedSpeciesFilter !== "all" && sp !== selectedSpeciesFilter) {
        return false;
      }
      if (!search.trim()) return true;
      return matchesTextQuery(search, [
        b.code,
        b.breed,
        sp,
        SPECIES_LABEL[sp],
        b.status,
        batchStatusLabels[b.status]?.label,
        b.purpose,
        b.systemType,
        b.avgWeightKg,
        b.notes,
        b.readinessReasons.join(" "),
      ]);
    });
  }, [batches, search, selectedSpeciesFilter]);

  // Cálculo en tiempo real de rentabilidad para el modal de lote
  const liveCalculation = useMemo(() => {
    const sp = batchForm.species || "pollo";
    const p = getParams(sp, batchForm.breed) || getParams(sp);
    if (!p) return null;
    const qty = Number(batchForm.initialQuantity) || 0;
    const acqCost = Number(batchForm.acquisitionCostEst) || 0;
    const autoCons = Math.min(qty, Number(batchForm.headsAutoconsumoEst) || 0);

    if (qty <= 0) return null;
    return calcularRentabilidadLote(p, qty, acqCost, autoCons);
  }, [batchForm.species, batchForm.breed, batchForm.initialQuantity, batchForm.acquisitionCostEst, batchForm.headsAutoconsumoEst, getParams]);

  return (
    <div>
      {!embedded && <PageHeader
        theme="aves"
        title="Lotes Multiespecie y Gallos"
        description="Gestión integral de lotes de engorde (pollos, codornices, patos y conejos) y gallos reproductores"
        help="Aquí gestionas los lotes de crianza y engorde de todas las especies de la granja:\n\n• Pollos de engorde (ciclo ~7 sem, ~2.5 kg)\n• Codornices (ciclo ~6 sem, postura o carne)\n• Patos Pekín y Criollos (ciclo 8-12 sem, carne tierna)\n• Conejos de engorde (ciclo ~11 sem / 77 días, carne magra)\n\nEl sistema evalúa automáticamente si el lote cumplió la edad o peso objetivo para faena."
        actions={
          <div className="flex gap-2">
            {tab === "gallos" && <Link href="/dashboard/produccion/adquisiciones?nuevo=gallo" className="inline-flex items-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Registrar ingreso de gallos</Link>}
            {tab === "lotes" && <Link href="/dashboard/produccion/adquisiciones?nuevo=lote_pollos" className="inline-flex items-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Registrar lote nuevo</Link>}
          </div>
        }
      />}

      {/* Banner de balance gallos/gallinas */}
      {!embedded && balance && (
        <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${balance.deficit > 0 ? "bg-orange-50 border border-orange-200 text-orange-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
          {balance.deficit > 0 ? (
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-orange-600" aria-hidden="true" />
              <span>Faltan <strong>{balance.deficit}</strong> gallo{balance.deficit > 1 ? "s" : ""} reproductor{balance.deficit > 1 ? "es" : ""}: se requieren <strong>{balance.required}</strong> para las gallinas activas y hay <strong>{balance.active}</strong> activos.</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" aria-hidden="true" />
              <span>Balance correcto: <strong>{balance.active}</strong> gallo{balance.active !== 1 ? "s" : ""} activos para un requerimiento de <strong>{balance.required}</strong> (1 gallo por cada 10 gallinas).</span>
            </span>
          )}
        </div>
      )}

      {/* StatCards Principales */}
      {!embedded && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon="rooster" label="Gallos Activos" value={activeRoosters} color="red" />
        <StatCard icon="chick" label="Total Animales en Lotes" value={totalInBatches} color="yellow" />
        <StatCard icon="check-circle" label="Lotes Listos para Faena" value={readyBatches.length} color="green" />
        <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200 flex flex-col justify-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Población por Especie</p>
          <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-1"><AppIcon icon="rooster" className="w-3.5 h-3.5 text-slate-600" /> {animalsBySpecies.pollo || 0}</span>
            <span className="inline-flex items-center gap-1"><AppIcon icon="egg" className="w-3.5 h-3.5 text-slate-600" /> {animalsBySpecies.codorniz || 0}</span>
            <span className="inline-flex items-center gap-1"><AppIcon icon="duck" className="w-3.5 h-3.5 text-slate-600" /> {animalsBySpecies.pato || 0}</span>
            <span className="inline-flex items-center gap-1"><AppIcon icon="rabbit" className="w-3.5 h-3.5 text-slate-600" /> {animalsBySpecies.conejo || 0}</span>
          </div>
        </div>
      </div>}

      {/* Tabs Principales: Gallos vs Lotes */}
      {!embedded && <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => { setTab("gallos"); setSearch(""); }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "gallos" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
        >
          <AppIcon icon="rooster" className="w-4 h-4" />
          <span>Gallos Reproductores</span>
        </button>
        <button
          onClick={() => { setTab("lotes"); setSearch(""); }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "lotes" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
        >
          <AppIcon icon="boxes" className="w-4 h-4" />
          <span>Lotes de Crianza / Engorde</span>
        </button>
      </div>}

      {/* ─── TAB: GALLOS ─── */}
      {tab === "gallos" && (
        <Card>
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar por código, raza o estado..."
            resultCount={filteredRoosters.length}
            totalCount={roosters.length}
            className="mb-4"
          />
          {loading ? (
            <p className="text-center py-8 text-slate-400">Cargando...</p>
          ) : filteredRoosters.length === 0 ? (
            <EmptyState
              icon="rooster"
              message={
                search.trim()
                  ? "No hay gallos que coincidan con la búsqueda"
                  : "No hay gallos registrados"
              }
            />
          ) : (
            <Table headers={["Código", "Raza", "Edad", "Peso", "Estado", ""]}>
              {filteredRoosters.map((r) => {
                const st = roosterStatusLabels[r.status] || { label: r.status, color: "gray" };
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-red-700">
                      <span className="inline-flex items-center gap-1.5">
                        <AppIcon icon="rooster" className="w-4 h-4 shrink-0" />
                        <span>{r.code}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{r.breed}</td>
                    <td className="px-4 py-3 text-sm">{r.ageWeeks} sem</td>
                    <td className="px-4 py-3 text-sm">{r.weight ? `${r.weight} kg` : "—"}</td>
                    <td className="px-4 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEditRooster(r)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => removeRooster(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      )}

      {/* ─── TAB: LOTES MULTIESPECIE ─── */}
      {tab === "lotes" && (
        <Card>
          {/* Filtro por Especie (Pills) */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            {!embedded && <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "Todas", icon: "globe" },
                { id: "pollo", label: "Pollos", icon: "rooster" },
                { id: "codorniz", label: "Codornices", icon: "egg" },
                { id: "pato", label: "Patos", icon: "duck" },
                { id: "conejo", label: "Conejos", icon: "rabbit" },
              ].map((sp) => {
                const isSelected = selectedSpeciesFilter === sp.id;
                const count = sp.id === "all"
                  ? batches.length
                  : batches.filter((b) => (b.species || "pollo") === sp.id).length;
                return (
                  <button
                    key={sp.id}
                    onClick={() => setSelectedSpeciesFilter(sp.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <AppIcon icon={sp.icon} className="w-3.5 h-3.5" />
                    <span>{sp.label} ({count})</span>
                  </button>
                );
              })}
            </div>}

            <TableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar lote, raza, propósito..."
              resultCount={filteredBatches.length}
              totalCount={batches.length}
              className="w-full sm:w-64"
            />
          </div>

          {loading ? (
            <p className="text-center py-8 text-slate-400">Cargando...</p>
          ) : filteredBatches.length === 0 ? (
            <EmptyState
              icon="boxes"
              message={
                search.trim() || selectedSpeciesFilter !== "all"
                  ? "No hay lotes que coincidan con los filtros"
                  : "No hay lotes de engorde o crianza registrados"
              }
            />
          ) : (
            <Table headers={["Código", "Especie / Raza", "Propósito / Sistema", "Edad", "Población", "Peso Prom.", "Objetivo", "Estado", ""]}>
              {filteredBatches.map((b) => {
                const sp = b.species || "pollo";
                const icon = SPECIES_ICON[sp] || "package";
                const st = batchStatusLabels[b.status] || { label: b.status, color: "gray" };
                const isConejo = sp === "conejo";

                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <span className="text-orange-700">{b.code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <AppIcon icon={icon} className="w-4 h-4 text-slate-600 shrink-0" />
                        <span>{b.breed}</span>
                      </div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider">{SPECIES_LABEL[sp] || sp}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium text-slate-700">{purposeLabels[b.purpose || "engorde_carne"] || b.purpose || "Engorde"}</p>
                      <p className="text-slate-400">{systemTypeLabels[b.systemType || "piso"] || b.systemType || "Piso"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isConejo && b.targetDays ? (
                        <span>{b.ageWeeks * 7} días</span>
                      ) : (
                        <span>{b.ageWeeks} sem</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-semibold text-slate-800">{b.currentQuantity}</span>
                      <span className="text-xs text-slate-400"> / {b.initialQuantity}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{b.avgWeightKg ? `${b.avgWeightKg} kg` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>
                        {b.targetDays ? `${b.targetDays} días` : `${b.targetWeeks} sem`} o {Number(b.targetWeightKg)} kg
                      </div>
                      {b.feedConversionTarget && (
                        <div className="text-slate-400">FCR: {b.feedConversionTarget}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={st.color}>{st.label}</Badge>
                      {b.readinessReasons.length > 0 && (
                        <p className="text-xs text-orange-600 mt-1 font-medium">{b.readinessReasons.join(" · ")}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQrBatch(b)} className="inline-flex items-center gap-1 text-emerald-700 hover:underline text-xs font-medium" title="Etiqueta QR del lote">
                          <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>QR</span>
                        </button>
                        <button onClick={() => openEditBatch(b)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => removeBatch(b.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      )}

      {/* ─── Modal Gallo ─── */}
      <Modal open={roosterModalOpen} onClose={() => setRoosterModalOpen(false)} title="Editar Gallo">
        <div className="space-y-4">
          {roosterError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{roosterError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Código (opcional)" help="Código del gallo. Si lo dejas vacío se genera automáticamente (GA-###)." placeholder="Autogenerado GA-###" value={roosterForm.code} onChange={(e) => setRoosterForm({ ...roosterForm, code: e.target.value })} disabled={!!editingRooster} />
            <Select label="Raza *" help="Solo razas asociadas a gallinas y gallos." value={roosterForm.breed} onChange={(e) => setRoosterForm({ ...roosterForm, breed: e.target.value })}>
              {roosterBreedOptions.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha de nacimiento *" help="Fecha de nacimiento del gallo." type="date" value={roosterForm.birthDate} onChange={(e) => setRoosterForm({ ...roosterForm, birthDate: e.target.value })} />
            <Input label="Peso (kg)" help="Peso actual del gallo." type="number" step="0.1" value={roosterForm.weight} onChange={(e) => setRoosterForm({ ...roosterForm, weight: e.target.value })} />
          </div>
          <Select label="Estado" help="Estado actual del gallo reproductor." value={roosterForm.status} onChange={(e) => setRoosterForm({ ...roosterForm, status: e.target.value })}>
            {Object.entries(roosterStatusLabels).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Textarea label="Notas" help="Observaciones sobre el gallo." value={roosterForm.notes} onChange={(e) => setRoosterForm({ ...roosterForm, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={saveRooster}>Actualizar</Button>
            <Button variant="secondary" onClick={() => setRoosterModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Modal Lote Multiespecie ─── */}
      <Modal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={`Editar Lote ${editingBatch?.code || ""}`}
      >
        <div className="space-y-4">
          {batchError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{batchError}</p>}

          {/* Selección de Especie y Propósito */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Especie *"
              help="Tipo de animal del lote."
              value={batchForm.species}
              onChange={(e) => handleSpeciesChange(e.target.value)}
              disabled={!!editingBatch}
            >
              <option value="pollo">Pollo de engorde</option>
              <option value="codorniz">Codorniz</option>
              <option value="pato">Pato</option>
              <option value="conejo">Conejo de engorde</option>
            </Select>

            <Select
              label="Propósito *"
              help="Destino principal de la producción."
              value={batchForm.purpose}
              onChange={(e) => setBatchForm({ ...batchForm, purpose: e.target.value })}
            >
              <option value="engorde_carne">Engorde para carne</option>
              <option value="postura_huevo">Postura de huevos</option>
              <option value="pie_cria">Pie de cría / reproductores</option>
              <option value="mixto">Doble propósito</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Código (opcional)"
              help="Si lo dejas vacío se genera según la especie (L-###, L-COD-###, L-PAT-###, L-CON-###)."
              placeholder="Autogenerado"
              value={batchForm.code}
              onChange={(e) => setBatchForm({ ...batchForm, code: e.target.value })}
              disabled={!!editingBatch}
            />
            <Select
              label="Raza o tipo *"
              help={`Opciones asociadas a ${batchBreedSpecies}. Agrega más desde Catálogos → Razas por especie.`}
              value={batchForm.breed}
              onChange={(e) => setBatchForm({ ...batchForm, breed: e.target.value })}
            >
              {batchBreedOptions.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Sistema de Crianza"
              help="Ambiente y alojamiento del lote."
              value={batchForm.systemType}
              onChange={(e) => setBatchForm({ ...batchForm, systemType: e.target.value })}
            >
              <option value="piso">Galpón / Piso en viruta</option>
              <option value="pastoreo">Pastoreo / Campero al aire libre</option>
              <option value="jaulas">Jaulas modulares</option>
              <option value="baterias">Baterías verticales</option>
            </Select>

            <Input
              label="Fecha de inicio *"
              help="Fecha en que ingresaron los animales a la granja."
              type="date"
              value={batchForm.startDate}
              onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cantidad inicial (cabezas) *"
              help="Número de animales que inician el ciclo."
              type="number"
              min="1"
              value={batchForm.initialQuantity}
              onChange={(e) => setBatchForm({ ...batchForm, initialQuantity: e.target.value })}
            />
            {editingBatch ? (
              <Input
                label="Cantidad actual (vivos)"
                help="Animales vivos actualmente en el lote."
                type="number"
                min="0"
                value={batchForm.currentQuantity}
                onChange={(e) => setBatchForm({ ...batchForm, currentQuantity: e.target.value })}
              />
            ) : (
              <Input
                label="Costo de adquisición total ($ COP)"
                help="Opcional: costo de compra de las crías/pollitos para calcular rentabilidad."
                type="number"
                placeholder="0"
                value={batchForm.acquisitionCostEst}
                onChange={(e) => setBatchForm({ ...batchForm, acquisitionCostEst: e.target.value })}
              />
            )}
          </div>

          {/* Parámetros zootécnicos del ciclo */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Ciclo objetivo (sem)"
              help="Semanas estimadas de crianza."
              type="number"
              min="1"
              value={batchForm.targetWeeks}
              onChange={(e) => setBatchForm({ ...batchForm, targetWeeks: e.target.value, targetDays: String(Number(e.target.value) * 7) })}
            />
            <Input
              label="Días objetivo"
              help="Días totales del ciclo (clave para conejos y codornices)."
              type="number"
              min="1"
              value={batchForm.targetDays}
              onChange={(e) => setBatchForm({ ...batchForm, targetDays: e.target.value })}
            />
            <Input
              label="Peso objetivo vivo (kg)"
              help="Peso esperado por animal a la faena."
              type="number"
              step="0.01"
              value={batchForm.targetWeightKg}
              onChange={(e) => setBatchForm({ ...batchForm, targetWeightKg: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Peso promedio actual (kg)"
              help="Muestreo de peso actual (opcional)."
              type="number"
              step="0.01"
              placeholder="Ej: 1.4"
              value={batchForm.avgWeightKg}
              onChange={(e) => setBatchForm({ ...batchForm, avgWeightKg: e.target.value })}
            />
            <Input
              label="FCR objetivo (Conversión alimenticia)"
              help="kg de alimento por cada kg de ganancia de peso (ej: 1.9, 2.7)."
              type="number"
              step="0.1"
              placeholder="Ej: 2.0"
              value={batchForm.feedConversionTarget}
              onChange={(e) => setBatchForm({ ...batchForm, feedConversionTarget: e.target.value })}
            />
          </div>

          {/* Calculadora Inline de Proyección del Lote */}
          {!editingBatch && liveCalculation && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center justify-between font-semibold border-b border-emerald-200 pb-1">
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  <span>Proyección Zootécnica y Rentabilidad Dual</span>
                </span>
                <span className="text-emerald-700">Ciclo ~{liveCalculation.roiDias} días</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="text-slate-500 block">Alimento estimado</span>
                  <strong className="text-slate-800">
                    {(liveCalculation.costoAlimentoTotal / 2800).toFixed(1)} kg
                  </strong>
                  <span className="text-[10px] text-slate-400 block">${liveCalculation.costoAlimentoTotal.toLocaleString("es-CO")}</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="text-slate-500 block">Carne en canal total</span>
                  <strong className="text-slate-800">{liveCalculation.kgCanalTotal.toFixed(1)} kg</strong>
                  <span className="text-[10px] text-slate-400 block">Rendimiento canal</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="text-slate-500 block">Ahorro Hogar</span>
                  <strong className="text-emerald-700">
                    ${liveCalculation.ahorroAutoconsumo.toLocaleString("es-CO")}
                  </strong>
                  <span className="text-[10px] text-emerald-600 block">{batchForm.headsAutoconsumoEst} cabezas</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="text-slate-500 block">Venta Excedentes</span>
                  <strong className="text-blue-700">
                    ${liveCalculation.ingresoExcedentes.toLocaleString("es-CO")}
                  </strong>
                  <span className="text-[10px] text-blue-600 block">Excedente estimado</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 text-emerald-800">
                <span>Beneficio total (Ahorro + Ingreso - Costos):</span>
                <strong className="text-sm font-bold text-emerald-800">
                  ${liveCalculation.margenNeto.toLocaleString("es-CO")}
                </strong>
              </div>
            </div>
          )}

          {editingBatch && (
            <Select label="Estado" help="Estado actual del lote." value={batchForm.status} onChange={(e) => setBatchForm({ ...batchForm, status: e.target.value })}>
              {Object.entries(batchStatusLabels).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          )}

          <Textarea label="Notas" help="Observaciones o registros particulares sobre el lote." value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} />

          <div className="flex gap-3">
            <Button onClick={saveBatch}>Actualizar</Button>
            <Button variant="secondary" onClick={() => setBatchModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      <EntityQrModal
        open={Boolean(qrBatch)}
        onClose={() => setQrBatch(null)}
        entityType="lote"
        entityId={qrBatch?.id || ""}
        code={qrBatch?.code}
        title={qrBatch ? `Lote ${qrBatch.code}` : "Lote"}
        subtitle={qrBatch ? `${SPECIES_LABEL[qrBatch.species || "pollo"] || qrBatch.species} · ${qrBatch.breed} (${qrBatch.currentQuantity} aves)` : undefined}
      />
    </div>
  );
}
