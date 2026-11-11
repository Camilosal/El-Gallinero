"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import { getBreedsForSpecies, speciesForAcquisitionType } from "@/lib/animal-breeds";
import { Card, StatCard, PageHeader, Button, Input, Select, Textarea, Modal, Table, Badge, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useFarmLocations } from "@/lib/useFarmLocations";

type Acquisition = {
  id: string;
  date: string;
  acquisitionType: string;
  birdType: string;
  quantity: number;
  unitCost: string | null;
  totalCost: string | null;
  supplier: string | null;
  breed: string | null;
  geneticLine: string | null;
  generation: string | null;
  originFarm: string | null;
  originLocation: string | null;
  sourceBatchCode: string | null;
  motherHenId: string | null;
  fatherRoosterId: string | null;
  motherIdentifier: string | null;
  fatherIdentifier: string | null;
  geneticEvidenceReference: string | null;
  healthEvidenceReference: string | null;
  birthDate: string | null;
  destinationLocationId: string | null;
  destinationLocationName: string | null;
  notes: string | null;
  registeredCodes: string[];
  createdAt: string;
  purpose?: string | null;
};

type ParentAnimal = { id: string; code: string; breed: string; status: string };

interface InventorySummary {
  totalAnimals: number;
  totalBirds: number;
  totalNonBirds: number;
  registeredHens: number;
  activeHens: number;
  layingHens: number;
  activeRoosters: number;
  activeBatches: number;
}

const TYPE_LABELS: Record<string, string> = { compra: "Compra", donacion: "Donación", pollito_comprado: "Pollitos comprados", cria_propia: "Cría propia / eclosión" };
const TYPE_COLORS: Record<string, string> = { compra: "blue", donacion: "green", pollito_comprado: "purple", cria_propia: "yellow" };
const BIRD_LABELS: Record<string, string> = {
  gallina: "Gallinas",
  gallo: "Gallos",
  lote_pollos: "Lote de pollos",
  codorniz: "Lote de codornices",
  pato: "Lote de patos",
  conejo: "Lote de conejos",
};
const PURPOSE_LABELS: Record<string, string> = {
  engorde_carne: "Engorde / carne",
  postura_huevo: "Postura de huevos",
  pie_cria: "Pie de cría",
  mixto: "Doble propósito",
};

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  acquisitionType: "compra",
  birdType: "gallina",
  purpose: "engorde_carne",
  quantity: "1",
  unitCost: "",
  supplier: "",
  breed: "Criolla",
  geneticLine: "",
  generation: "",
  originFarm: "",
  originLocation: "",
  sourceBatchCode: "",
  motherHenId: "",
  fatherRoosterId: "",
  motherIdentifier: "",
  fatherIdentifier: "",
  geneticEvidenceReference: "",
  healthEvidenceReference: "",
  birthDate: new Date().toISOString().split("T")[0],
  destinationLocationId: "",
  notes: "",
};

export default function AdquisicionesPage() {
  const [items, setItems] = useState<Acquisition[]>([]);
  const [parentHens, setParentHens] = useState<ParentAnimal[]>([]);
  const [parentRoosters, setParentRoosters] = useState<ParentAnimal[]>([]);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { locations } = useFarmLocations();

  const razas = useCatalog("raza", ["Criolla", "Leghorn", "Rhode Island", "Plymouth Rock"]);
  const proveedores = useCatalog("proveedor", []);
  const selectedSpecies = speciesForAcquisitionType(form.birdType) || "gallina";
  const breedOptions = getBreedsForSpecies(razas.items, selectedSpecies, editingId ? form.breed : null);

  const load = useCallback(async () => {
    const [res, invRes, hensRes, roostersRes] = await Promise.all([
      apiFetch("/api/produccion/adquisiciones"),
      apiFetch("/api/inventarios/animales"),
      apiFetch("/api/produccion/gallinas"),
      apiFetch("/api/produccion/gallos"),
    ]);
    if (res.ok) setItems(await res.json());
    if (hensRes.ok) setParentHens(await hensRes.json());
    if (roostersRes.ok) setParentRoosters(await roostersRes.json());
    if (invRes.ok) {
      const inv = await invRes.json();
      setInventory(inv.summary);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const searchParams = new URLSearchParams(window.location.search);
      const requestedType = searchParams.get("nuevo");
      const requestedOrigin = searchParams.get("origen");
      const requestedPurpose = searchParams.get("proposito");
      const validTypes = ["gallina", "gallo", "lote_pollos", "codorniz", "pato", "conejo"];
      if (requestedType && !validTypes.includes(requestedType)) return;
      if (!requestedType && requestedOrigin !== "cria_propia") return;
      setEditingId(null);
      setForm({
        ...emptyForm,
        birdType: requestedType || emptyForm.birdType,
        breed: getBreedsForSpecies([], speciesForAcquisitionType(requestedType || emptyForm.birdType) || "gallina")[0] || "",
        acquisitionType: requestedOrigin === "cria_propia" ? "cria_propia" : emptyForm.acquisitionType,
        purpose: requestedPurpose && Object.hasOwn(PURPOSE_LABELS, requestedPurpose) ? requestedPurpose : emptyForm.purpose,
      });
      setError("");
      setModalOpen(true);
    });
  }, []);

  const totalAves = items.reduce((s, i) => s + Number(i.quantity), 0);
  const totalInversion = items.filter(i => !["donacion", "cria_propia"].includes(i.acquisitionType)).reduce((s, i) => s + Number(i.totalCost || 0), 0);
  const compras = items.filter(i => ["compra", "pollito_comprado"].includes(i.acquisitionType)).length;
  const donaciones = items.filter(i => i.acquisitionType === "donacion").length;
  const criasPropias = items.filter(i => i.acquisitionType === "cria_propia").length;

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((item) =>
      matchesTextQuery(search, [
        item.date,
        TYPE_LABELS[item.acquisitionType] || item.acquisitionType,
        BIRD_LABELS[item.birdType] || item.birdType,
        item.quantity,
        item.breed,
        item.supplier,
        item.geneticLine,
        item.generation,
        item.originFarm,
        item.originLocation,
        item.sourceBatchCode,
        item.motherIdentifier,
        item.fatherIdentifier,
        item.geneticEvidenceReference,
        item.healthEvidenceReference,
        item.registeredCodes.join(" "),
        item.unitCost,
        item.totalCost,
        item.notes,
      ]),
    );
  }, [items, search]);

  const save = async () => {
    setError("");
    if (!form.date) return setError("La fecha es requerida");
    if (!form.quantity || Number(form.quantity) < 1) return setError("Cantidad mínima: 1");
    if (!editingId && !form.destinationLocationId) return setError("Selecciona el lugar donde se alojará el animal o lote");
    if (!(["donacion", "cria_propia"].includes(form.acquisitionType)) && (!form.unitCost || Number(form.unitCost) <= 0)) return setError("El costo unitario debe ser mayor que cero para compras");

    const res = await apiFetch("/api/produccion/adquisiciones", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
    });
    if (!res.ok) { const e = await res.json(); return setError(e.error || "Error"); }
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta adquisición? Se eliminarán las aves asociadas si aún no tienen movimientos registrados.")) return;
    const res = await apiFetch(`/api/produccion/adquisiciones?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      window.alert(error.error || "No se pudo eliminar la adquisición");
      return;
    }
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adquisiciones y entradas de animales"
        description="Registra el origen y el linaje junto con cada ficha individual o lote"
        help="Cada animal o lote queda enlazado a su ingreso. Registra criador, procedencia, lote de origen, línea genética, generación, progenitores y referencias de documentos. Si los animales tienen familias de origen distintas, crea un ingreso separado para cada una. Una referencia documental no significa que el sistema haya validado el documento."
        actions={<Button onClick={() => { setEditingId(null); setForm(emptyForm); setError(""); setModalOpen(true); }}>Nueva entrada y trazabilidad</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon="📥" label="Animales ingresados (histórico)" value={String(totalAves)} color="green" />
        <StatCard icon="💰" label="Inversión total" value={`$${totalInversion.toLocaleString()}`} color="blue" />
        <StatCard icon="🛒" label="Compras" value={String(compras)} color="purple" />
        <StatCard icon="🎁" label="Donaciones" value={String(donaciones)} color="yellow" />
        <StatCard icon="🐣" label="Cría propia" value={String(criasPropias)} color="blue" />
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <p className="font-semibold mb-1">📋 Registra aquí cada ingreso y revisa después su seguimiento</p>
        <p>
          Los {totalAves} animales ingresados suman compras, donaciones y crías propias registradas desde el inicio.
          Algunos ya se vendieron, faenaron o murieron; el historial conserva su origen.
        </p>
        <p className="mt-2">
          Inventario vigente hoy:{" "}
          <strong>{inventory ? `${inventory.totalAnimals} animales` : "—"}</strong>
          {inventory && (
            <span className="text-blue-700">
              {" "}({inventory.activeHens} gallinas
              {inventory.layingHens > 0 ? `, ${inventory.layingHens} en postura` : ""}
              {" · "}{inventory.activeRoosters} gallos
              {" · "}{inventory.activeBatches} lote{inventory.activeBatches === 1 ? "" : "s"})
            </span>
          )}
        </p>
        <Link href="/dashboard/inventarios/balance" className="inline-block mt-2 text-xs font-semibold text-blue-700 hover:underline">
          Ver balance de inventario →
        </Link>
      </div>

      <Card>
        <TableSearch
          value={search}
          onChange={setSearch}
        placeholder="Buscar por animal, fecha, linaje, criador o progenitores..."
          resultCount={filteredItems.length}
          totalCount={items.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon="📥"
            message={
              search.trim()
                ? "No hay adquisiciones que coincidan con la búsqueda"
                : "No hay adquisiciones registradas"
            }
          />
        ) : (
          <Table headers={["Fecha", "Ingreso", "Animal", "Propósito", "Lugar inicial", "Cantidad", "Raza / línea", "Familia de origen", "Criador / proveedor", "Identificación", "Documentos", "Costo unitario", "Total", "Acciones"]}>
            {filteredItems.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{a.date}</td>
                <td className="px-4 py-3"><Badge color={TYPE_COLORS[a.acquisitionType] || "gray"}>{TYPE_LABELS[a.acquisitionType] || a.acquisitionType}</Badge></td>
                <td className="px-4 py-3 text-sm">{BIRD_LABELS[a.birdType] || a.birdType}</td>
                <td className="px-4 py-3 text-sm">{a.purpose ? PURPOSE_LABELS[a.purpose] || a.purpose : ["gallina", "gallo"].includes(a.birdType) ? "Ficha individual" : "—"}</td>
                <td className="px-4 py-3 text-sm">{a.destinationLocationName || "Sin asignar"}</td>
                <td className="px-4 py-3 text-sm font-medium">{a.quantity}</td>
                <td className="px-4 py-3 text-sm">{a.breed || "—"}{a.geneticLine && <span className="block text-xs text-slate-500">{a.geneticLine}{a.generation ? ` · ${a.generation}` : ""}</span>}</td>
                <td className="px-4 py-3 text-xs">{a.motherIdentifier || a.fatherIdentifier ? <>{a.motherIdentifier ? `♀ ${a.motherIdentifier}` : "♀ —"}<br />{a.fatherIdentifier ? `♂ ${a.fatherIdentifier}` : "♂ —"}</> : a.sourceBatchCode || "—"}</td>
                <td className="px-4 py-3 text-sm">{a.originFarm || a.supplier || "—"}{a.originLocation && <span className="block text-xs text-slate-500">{a.originLocation}</span>}</td>
                <td className="px-4 py-3 text-xs">{a.registeredCodes.length ? <><strong>{a.registeredCodes.length}</strong> {(["gallina", "gallo"].includes(a.birdType)) ? "ficha(s)" : "lote(s)"}<span className="block text-slate-500">{a.registeredCodes.slice(0, 2).join(", ")}{a.registeredCodes.length > 2 ? ` +${a.registeredCodes.length - 2}` : ""}</span></> : "Sin ficha enlazada"}</td>
                <td className="px-4 py-3 text-xs">
                  {a.geneticEvidenceReference || a.healthEvidenceReference ? <div className="space-y-1">
                    {a.geneticEvidenceReference && <div>{/^https?:\/\//i.test(a.geneticEvidenceReference) ? <a href={a.geneticEvidenceReference} target="_blank" rel="noreferrer" className="text-blue-700 underline">Genética</a> : <span title={a.geneticEvidenceReference}>Genética · referencia</span>}</div>}
                    {a.healthEvidenceReference && <div>{/^https?:\/\//i.test(a.healthEvidenceReference) ? <a href={a.healthEvidenceReference} target="_blank" rel="noreferrer" className="text-green-700 underline">Sanidad</a> : <span title={a.healthEvidenceReference}>Sanidad · referencia</span>}</div>}
                  </div> : "Sin referencia"}
                </td>
                <td className="px-4 py-3 text-sm">{a.unitCost ? `$${Number(a.unitCost).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-sm font-medium">{a.totalCost ? `$${Number(a.totalCost).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditingId(a.id);
                      setForm({
                        ...emptyForm,
                        date: a.date,
                        acquisitionType: a.acquisitionType,
                        birdType: a.birdType,
                        purpose: a.purpose || "engorde_carne",
                        quantity: String(a.quantity),
                        unitCost: a.unitCost || "",
                        supplier: a.supplier || "",
                        breed: a.breed || "",
                        geneticLine: a.geneticLine || "",
                        generation: a.generation || "",
                        originFarm: a.originFarm || "",
                        originLocation: a.originLocation || "",
                        sourceBatchCode: a.sourceBatchCode || "",
                        motherHenId: a.motherHenId || "",
                        fatherRoosterId: a.fatherRoosterId || "",
                        motherIdentifier: a.motherIdentifier || "",
                        fatherIdentifier: a.fatherIdentifier || "",
                        geneticEvidenceReference: a.geneticEvidenceReference || "",
                        healthEvidenceReference: a.healthEvidenceReference || "",
                        birthDate: a.birthDate || new Date().toISOString().split("T")[0],
                        destinationLocationId: a.destinationLocationId || "",
                        notes: a.notes || "",
                      });
                      setError("");
                      setModalOpen(true);
                    }} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(a.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} title={editingId ? "✏️ Editar Adquisición" : "Nueva Adquisición"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <Select label="Origen" value={form.acquisitionType} onChange={(e) => setForm({ ...form, acquisitionType: e.target.value })} help="Indica cómo llegaron estos animales a la granja.">
              <option value="compra">Compra</option>
              <option value="donacion">Donación</option>
              <option value="pollito_comprado">Pollitos comprados</option>
              <option value="cria_propia">Cría propia / eclosión</option>
            </Select>
            <Select label="Tipo de animal" value={form.birdType} onChange={(e) => {
              const birdType = e.target.value;
              const species = speciesForAcquisitionType(birdType) || "gallina";
              setForm({
                ...form,
                birdType,
                breed: getBreedsForSpecies(razas.items, species)[0] || "",
                motherHenId: ["gallina", "pollo"].includes(species) ? form.motherHenId : "",
                fatherRoosterId: ["gallina", "pollo"].includes(species) ? form.fatherRoosterId : "",
                purpose: ["codorniz", "pato"].includes(birdType) ? form.purpose : "engorde_carne",
              });
            }} disabled={!!editingId} help="El tipo determina la ficha o lote y limita las razas disponibles a esa especie.">
              <optgroup label="Fichas individuales">
                <option value="gallina">Gallinas</option>
                <option value="gallo">Gallos</option>
              </optgroup>
              <optgroup label="Lotes por especie">
                <option value="lote_pollos">Pollos</option>
                <option value="codorniz">Codornices</option>
                <option value="pato">Patos</option>
                <option value="conejo">Conejos</option>
              </optgroup>
            </Select>
          </div>

          {!["gallina", "gallo"].includes(form.birdType) && (
            <Select label="Destino del lote" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} help={form.purpose === "postura_huevo" ? "La cantidad debe representar hembras ponedoras. Los machos y lotes de doble propósito no se cuentan en la tasa de postura." : "Separa lotes para carne, reproducción o doble propósito. Codornices y patos pueden marcarse para postura."}>
              <option value="engorde_carne">Engorde para carne</option>
              { ["codorniz", "pato"].includes(form.birdType) && <option value="postura_huevo">Postura de huevos (hembras)</option> }
              <option value="pie_cria">Pie de cría / reproducción</option>
              <option value="mixto">Doble propósito</option>
            </Select>
          )}

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <Select label={editingId ? "Lugar al momento del ingreso" : "Lugar de destino dentro de la finca"} value={form.destinationLocationId} onChange={(e) => setForm({ ...form, destinationLocationId: e.target.value })} disabled={!!editingId} help={editingId ? "El lugar inicial se conserva como parte de la trazabilidad. Para cambiar el alojamiento actual, registra un traslado desde Lugares de manejo." : "Selecciona el corral, jaula, galpón, potrero, jardín o patio donde quedará el animal."}>
              <option value="">Selecciona un lugar…</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.type}</option>)}
            </Select>
            {locations.length === 0 && <p className="mt-2 text-sm text-amber-900">Primero crea un lugar de manejo. <Link className="font-semibold underline" href="/dashboard/ubicaciones">Ir a Lugares de manejo</Link></p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} help="Fecha de la adquisición" />
            <Input label="Fecha nacimiento aprox." type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} help="Fecha estimada de nacimiento (útil para calcular edad y etapa productiva)" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Cantidad" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} disabled={!!editingId} help="Número de animales ingresados" />
            <Select label="Raza / tipo" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} help={`Opciones asociadas a ${selectedSpecies}. Puedes agregar razas desde Catálogos → Razas por especie.`}>
              {breedOptions.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
            </Select>
          </div>

          {!["donacion", "cria_propia"].includes(form.acquisitionType) && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Costo unitario" type="number" min="0" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} help="Precio pagado por cada ave" />
              <Input label="Total" value={form.unitCost && form.quantity ? `$${(Number(form.unitCost) * Number(form.quantity)).toLocaleString()}` : "—"} disabled help="Costo total calculado automáticamente (cantidad × costo unitario)" />
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-800">Origen y cadena de custodia</h3>
              <p className="mt-1 text-xs text-slate-500">Guarda quién entregó el animal y de qué criadero o lote proviene.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Proveedor o vendedor" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} list="proveedores-list" help="Persona o empresa que te entregó el animal." />
              <Input label="Granja o criadero de origen" value={form.originFarm} onChange={(e) => setForm({ ...form, originFarm: e.target.value })} help="Puede ser distinto del proveedor o intermediario." />
              <Input label="Ubicación de origen" value={form.originLocation} onChange={(e) => setForm({ ...form, originLocation: e.target.value })} placeholder="Municipio, departamento, país" />
              <Input label="Lote o código del criador" value={form.sourceBatchCode} onChange={(e) => setForm({ ...form, sourceBatchCode: e.target.value })} help="Código impreso en guía, factura, anillo o registro de origen." />
            </div>
            <datalist id="proveedores-list">{proveedores.values.map((v) => <option key={v} value={v} />)}</datalist>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-800">Genética y parentesco</h3>
              <p className="mt-1 text-xs text-slate-500">Registra la línea y generación tal como las informa el criador. El sistema no las calcula ni verifica.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Línea genética" value={form.geneticLine} onChange={(e) => setForm({ ...form, geneticLine: e.target.value })} placeholder="Ej. Isa Brown, Cobb 500" />
              <Input label="Generación" value={form.generation} onChange={(e) => setForm({ ...form, generation: e.target.value })} placeholder="Ej. F1, G1, bisabuelos" help="Dato declarado por el criador; no se infiere de la raza." />
            </div>
            {(["gallina", "pollo"].includes(selectedSpecies)) && (
              <div className="grid grid-cols-2 gap-4">
                <Select label="Madre registrada en la granja" value={form.motherHenId} onChange={(e) => setForm({ ...form, motherHenId: e.target.value, motherIdentifier: "" })} help="Opcional. Selecciona una ficha existente; su código queda guardado como referencia.">
                  <option value="">No registrada aquí</option>
                  {parentHens.map((hen) => <option key={hen.id} value={hen.id}>{hen.code} · {hen.breed} · {hen.status}</option>)}
                </Select>
                <Select label="Padre registrado en la granja" value={form.fatherRoosterId} onChange={(e) => setForm({ ...form, fatherRoosterId: e.target.value, fatherIdentifier: "" })} help="Opcional. Selecciona un gallo existente; su código queda guardado como referencia.">
                  <option value="">No registrado aquí</option>
                  {parentRoosters.map((rooster) => <option key={rooster.id} value={rooster.id}>{rooster.code} · {rooster.breed} · {rooster.status}</option>)}
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {!form.motherHenId && <Input label="Código de la madre en origen" value={form.motherIdentifier} onChange={(e) => setForm({ ...form, motherIdentifier: e.target.value })} help="Si no está registrada en la granja, usa el código del criador o escribe ‘desconocida’." />}
              {!form.fatherRoosterId && <Input label="Código del padre en origen" value={form.fatherIdentifier} onChange={(e) => setForm({ ...form, fatherIdentifier: e.target.value })} help="Si no está registrado en la granja, usa el código del criador o escribe ‘desconocido’." />}
            </div>
            <Input label="Referencia de certificado o documento genético" value={form.geneticEvidenceReference} onChange={(e) => setForm({ ...form, geneticEvidenceReference: e.target.value })} placeholder="URL, número de certificado o ubicación del archivo" help="Se guarda la referencia para consulta; el documento no se carga ni valida automáticamente." />
            <Input label="Referencia de certificado sanitario o vacunación" value={form.healthEvidenceReference} onChange={(e) => setForm({ ...form, healthEvidenceReference: e.target.value })} placeholder="URL, folio, clínica o ubicación del documento" help="Guarda el soporte sanitario de origen por separado del genético. El sistema no valida su contenido." />
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">La trazabilidad genética y sanitaria facilita la revisión y selección. No sustituye los registros de Sanidad, la evaluación veterinaria ni las pruebas de laboratorio.</p>
          </div>

          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} help="Observaciones sobre la adquisición (condiciones de llegada, transporte, etc.)" />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!form.date || !form.quantity || Number(form.quantity) < 1 || (!(["donacion", "cria_propia"].includes(form.acquisitionType)) && (!form.unitCost || Number(form.unitCost) <= 0))}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
