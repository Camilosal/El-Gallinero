# Reorganización Producción/Ventas/Operaciones — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar la navegación en 3 hojas con pestañas: Producción (huevos, carne, gallinas, pollos, gallinaza, incubación, alimentación), Ventas (huevos, aves, carne, gallinaza) y Operaciones (mantenimiento, sanidad).

**Architecture:** Las páginas existentes se mueven tal cual a componentes de pestaña en carpetas `_components/` de cada hub. Los hubs sincronizan la pestaña con `?tab=` en la URL. Las rutas antiguas quedan como redirecciones. Solo hay código nuevo en: los 3 hubs, el modal compartido de sacrificio y las 2 pestañas nuevas de Ventas (Carne y Gallinaza).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS. Sin cambios de base de datos ni de APIs.

**Nota:** Este proyecto no tiene repositorio git, por lo que los pasos de commit se omiten; la verificación se hace con `tsc`, `vitest`, `eslint` y peticiones HTTP al servidor de desarrollo (puerto 3001, autenticación por cookie `galli_session`).

**Spec:** `docs/superpowers/specs/2026-08-07-nav-reorganizacion-design.md`

---

### Task 1: Mover 7 módulos a `produccion/_components` y crear redirecciones

**Files:**
- Move: `src/app/(app)/huevos/page.tsx` → `src/app/(app)/produccion/_components/HuevosTab.tsx`
- Move: `src/app/(app)/sacrificio/page.tsx` → `src/app/(app)/produccion/_components/CarneTab.tsx`
- Move: `src/app/(app)/gallinas/page.tsx` → `src/app/(app)/produccion/_components/GallinasTab.tsx`
- Move: `src/app/(app)/pollos/page.tsx` → `src/app/(app)/produccion/_components/PollosTab.tsx`
- Move: `src/app/(app)/gallinaza/page.tsx` → `src/app/(app)/produccion/_components/GallinazaTab.tsx`
- Move: `src/app/(app)/incubacion/page.tsx` → `src/app/(app)/produccion/_components/IncubacionTab.tsx`
- Move: `src/app/(app)/alimentacion/page.tsx` → `src/app/(app)/produccion/_components/AlimentacionTab.tsx`
- Create: `src/app/(app)/huevos/page.tsx` (redirect), ídem para `sacrificio`, `gallinas`, `pollos`, `gallinaza`, `incubacion`, `alimentacion`

- [ ] **Step 1: Mover los 7 archivos (sin editar contenido)**

Run:
```bash
cd "/Users/espaciosplus/Downloads/Sistema Gallinero"
mkdir -p "src/app/(app)/produccion/_components"
mv "src/app/(app)/huevos/page.tsx"        "src/app/(app)/produccion/_components/HuevosTab.tsx"
mv "src/app/(app)/sacrificio/page.tsx"    "src/app/(app)/produccion/_components/CarneTab.tsx"
mv "src/app/(app)/gallinas/page.tsx"      "src/app/(app)/produccion/_components/GallinasTab.tsx"
mv "src/app/(app)/pollos/page.tsx"        "src/app/(app)/produccion/_components/PollosTab.tsx"
mv "src/app/(app)/gallinaza/page.tsx"     "src/app/(app)/produccion/_components/GallinazaTab.tsx"
mv "src/app/(app)/incubacion/page.tsx"    "src/app/(app)/produccion/_components/IncubacionTab.tsx"
mv "src/app/(app)/alimentacion/page.tsx"  "src/app/(app)/produccion/_components/AlimentacionTab.tsx"
```
Expected: los comandos terminan sin errores; `ls "src/app/(app)/produccion/_components"` muestra los 7 archivos `*Tab.tsx`.

- [ ] **Step 2: Crear las 7 páginas de redirección**

Crea cada uno de estos archivos con exactamente este contenido, cambiando solo la URL de destino según la tabla:

| Archivo | `redirect(...)` destino |
|---|---|
| `src/app/(app)/huevos/page.tsx` | `/produccion?tab=huevos` |
| `src/app/(app)/sacrificio/page.tsx` | `/produccion?tab=carne` |
| `src/app/(app)/gallinas/page.tsx` | `/produccion?tab=gallinas` |
| `src/app/(app)/pollos/page.tsx` | `/produccion?tab=pollos` |
| `src/app/(app)/gallinaza/page.tsx` | `/produccion?tab=gallinaza` |
| `src/app/(app)/incubacion/page.tsx` | `/produccion?tab=incubacion` |
| `src/app/(app)/alimentacion/page.tsx` | `/produccion?tab=alimentacion` |

Contenido (ejemplo para `huevos`):
```tsx
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/produccion?tab=huevos");
}
```
Nota: son server components — NO llevan `"use client"`.

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores. Si hay errores de import faltante, verifica que algún archivo no haya quedado en la carpeta equivocada.

---

### Task 2: Crear la página hub `/produccion`

**Files:**
- Create: `src/app/(app)/produccion/page.tsx`

- [ ] **Step 1: Escribir el hub**

```tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HuevosTab from "./_components/HuevosTab";
import CarneTab from "./_components/CarneTab";
import GallinasTab from "./_components/GallinasTab";
import PollosTab from "./_components/PollosTab";
import GallinazaTab from "./_components/GallinazaTab";
import IncubacionTab from "./_components/IncubacionTab";
import AlimentacionTab from "./_components/AlimentacionTab";

const TABS = [
  { key: "huevos", label: "🥚 Huevos", View: HuevosTab },
  { key: "carne", label: "🍗 Carne", View: CarneTab },
  { key: "gallinas", label: "🐔 Gallinas", View: GallinasTab },
  { key: "pollos", label: "🐓 Pollos y Gallos", View: PollosTab },
  { key: "gallinaza", label: "🌱 Gallinaza", View: GallinazaTab },
  { key: "incubacion", label: "🐣 Incubación", View: IncubacionTab },
  { key: "alimentacion", label: "🌾 Alimentación", View: AlimentacionTab },
];

function ProduccionTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const active = TABS.find((t) => t.key === param) ?? TABS[0];
  const ActiveView = active.View;

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit max-w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => router.replace(`/produccion?tab=${t.key}`, { scroll: false })}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              active.key === t.key ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ActiveView />
    </div>
  );
}

export default function ProduccionPage() {
  return (
    <Suspense fallback={null}>
      <ProduccionTabs />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificar en el servidor de desarrollo**

Run:
```bash
COOKIE=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' -c - | grep galli_session | awk '{print $NF}')
curl -s -o /dev/null -w "%{http_code}\n" -b "galli_session=$COOKIE" "http://localhost:3001/produccion?tab=huevos"
curl -s -o /dev/null -w "%{http_code}\n" -b "galli_session=$COOKIE" "http://localhost:3001/produccion?tab=carne"
curl -s -o /dev/null -w "%{http_code}\n" -b "galli_session=$COOKIE" "http://localhost:3001/huevos" -L
```
Expected: `200`, `200`, y `200` tras la redirección de `/huevos`. Si el servidor no está activo: `npm run dev -- -p 3001` en background.

---

### Task 3: Hoja Operaciones — mover módulos y crear hub

**Files:**
- Move: `src/app/(app)/mantenimiento/page.tsx` → `src/app/(app)/operaciones/_components/MantenimientoTab.tsx`
- Move: `src/app/(app)/sanidad/page.tsx` → `src/app/(app)/operaciones/_components/SanidadTab.tsx`
- Create: `src/app/(app)/mantenimiento/page.tsx` (redirect), `src/app/(app)/sanidad/page.tsx` (redirect)
- Create: `src/app/(app)/operaciones/page.tsx`

- [ ] **Step 1: Mover los 2 archivos**

Run:
```bash
cd "/Users/espaciosplus/Downloads/Sistema Gallinero"
mkdir -p "src/app/(app)/operaciones/_components"
mv "src/app/(app)/mantenimiento/page.tsx" "src/app/(app)/operaciones/_components/MantenimientoTab.tsx"
mv "src/app/(app)/sanidad/page.tsx"       "src/app/(app)/operaciones/_components/SanidadTab.tsx"
```

- [ ] **Step 2: Crear las 2 redirecciones**

`src/app/(app)/mantenimiento/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/operaciones?tab=mantenimiento");
}
```

`src/app/(app)/sanidad/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/operaciones?tab=sanidad");
}
```

- [ ] **Step 3: Crear el hub `src/app/(app)/operaciones/page.tsx`**

```tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MantenimientoTab from "./_components/MantenimientoTab";
import SanidadTab from "./_components/SanidadTab";

const TABS = [
  { key: "mantenimiento", label: "🔧 Mantenimiento", View: MantenimientoTab },
  { key: "sanidad", label: "💊 Control Sanitario", View: SanidadTab },
];

function OperacionesTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const active = TABS.find((t) => t.key === param) ?? TABS[0];
  const ActiveView = active.View;

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit max-w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => router.replace(`/operaciones?tab=${t.key}`, { scroll: false })}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              active.key === t.key ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ActiveView />
    </div>
  );
}

export default function OperacionesPage() {
  return (
    <Suspense fallback={null}>
      <OperacionesTabs />
    </Suspense>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores. Luego:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -b "galli_session=$COOKIE" "http://localhost:3001/operaciones?tab=sanidad"
```
Expected: `200` (reusa `$COOKIE` del Task 2, Step 3).

---

### Task 4: Extraer `SlaughterFormModal` compartido y refactorizar CarneTab

**Files:**
- Create: `src/components/SlaughterFormModal.tsx`
- Modify: `src/app/(app)/produccion/_components/CarneTab.tsx` (reescribir el archivo completo)

- [ ] **Step 1: Crear `src/components/SlaughterFormModal.tsx`**

Este componente contiene exactamente la lógica de formulario/modal que hoy vive en la página de sacrificio (carga de gallinas/gallos/lotes, selects encadenados, validaciones y guardado vía `/api/sacrificio`), más el modo `saleOnly` que fija el destino a `venta` y exige precio:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, Button, Input, Select, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";

export interface SlaughterRecord {
  id: string;
  date: string;
  birdType: string;
  quantity: number;
  weightKg: string;
  destination: string;
  pricePerKg: string | null;
  totalAmount: string | null;
  henId: string | null;
  roosterId: string | null;
  batchId: string | null;
  notes: string | null;
  hen?: { id: string; code: string; weight: string; status: string } | null;
  rooster?: { id: string; code: string; status: string } | null;
  batch?: { id: string; code: string; status: string } | null;
}

export const birdTypeLabels: Record<string, string> = {
  gallina_descarte: "🐔 Gallina descarte",
  pollo: "🐓 Pollo",
  gallo: "🐓 Gallo",
};

interface Hen { id: string; code: string; weight: string; status: string; }
interface Rooster { id: string; code: string; weight: string | null; status: string; }
interface Batch { id: string; code: string; currentQuantity: number; status: string; }

const emptyForm = (destination: string) => ({
  date: new Date().toISOString().split("T")[0],
  birdType: "gallina_descarte",
  quantity: "1",
  weightKg: "",
  destination,
  pricePerKg: "",
  henId: "",
  roosterId: "",
  batchId: "",
  notes: "",
});

interface Props {
  open: boolean;
  onClose: () => void;
  editing: SlaughterRecord | null;
  onSaved: () => void;
  saleOnly?: boolean;
}

export default function SlaughterFormModal({ open, onClose, editing, onSaved, saleOnly = false }: Props) {
  const [hens, setHens] = useState<Hen[]>([]);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm(saleOnly ? "venta" : "consumo_propio"));
  const { values: birdTypeOptions } = useCatalog("tipo_ave", ["gallina_descarte", "pollo", "gallo"]);

  const loadBirds = useCallback(() => {
    Promise.all([
      apiFetch("/api/gallinas").then((r) => r.json()),
      apiFetch("/api/gallos").then((r) => r.json()),
      apiFetch("/api/lotes-pollos").then((r) => r.json()),
    ]).then(([hensData, gallosData, lotesData]) => {
      setHens(Array.isArray(hensData) ? hensData
        .filter((h: Hen) => h.status === "activa" || h.status === "empollando" || h.status === "recomendada_sacrificio")
        .sort((a: Hen, b: Hen) => Number(b.status === "recomendada_sacrificio") - Number(a.status === "recomendada_sacrificio")) : []);
      setRoosters(Array.isArray(gallosData?.roosters) ? gallosData.roosters.filter((r: Rooster) => r.status === "activo" || r.status === "enfermo") : []);
      setBatches(Array.isArray(lotesData) ? lotesData.filter((b: Batch) => b.status === "activo" || b.status === "listo_sacrificio") : []);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setForm({
        date: editing.date,
        birdType: editing.birdType,
        quantity: String(editing.quantity),
        weightKg: editing.weightKg,
        destination: saleOnly ? "venta" : editing.destination,
        pricePerKg: editing.pricePerKg || "",
        henId: editing.henId || "",
        roosterId: editing.roosterId || "",
        batchId: editing.batchId || "",
        notes: editing.notes || "",
      });
    } else {
      setForm(emptyForm(saleOnly ? "venta" : "consumo_propio"));
    }
    loadBirds();
  }, [open, editing, saleOnly, loadBirds]);

  const handleHenSelect = (henId: string) => {
    if (henId) {
      const hen = hens.find((h) => h.id === henId);
      if (hen) {
        setForm({ ...form, henId, roosterId: "", batchId: "", weightKg: hen.weight, quantity: "1" });
      }
    } else {
      setForm({ ...form, henId: "" });
    }
  };

  const handleRoosterSelect = (roosterId: string) => {
    if (roosterId) {
      const rooster = roosters.find((r) => r.id === roosterId);
      setForm({ ...form, roosterId, henId: "", batchId: "", birdType: "gallo", weightKg: rooster?.weight || "", quantity: "1" });
    } else {
      setForm({ ...form, roosterId: "" });
    }
  };

  const handleBatchSelect = (batchId: string) => {
    if (batchId) {
      const batch = batches.find((b) => b.id === batchId);
      setForm({ ...form, batchId, henId: "", roosterId: "", birdType: "pollo", quantity: String(batch?.currentQuantity || 1) });
    } else {
      setForm({ ...form, batchId: "" });
    }
  };

  const save = async () => {
    setError("");
    const qty = Number(form.quantity);
    const weightKg = Number(form.weightKg);
    if (!form.birdType) { setError("Tipo de ave requerido"); return; }
    if (!form.henId && !form.roosterId && !form.batchId) { setError("Debe seleccionar una gallina, un gallo o un lote"); return; }
    if (!qty || qty < 1) { setError("Cantidad inválida"); return; }
    if (!weightKg || weightKg <= 0) { setError("Peso requerido"); return; }
    if (saleOnly && !form.pricePerKg) { setError("Precio por kg requerido para registrar una venta"); return; }

    const payload: Record<string, unknown> = {
      date: form.date,
      birdType: form.birdType,
      quantity: qty,
      weightKg,
      destination: form.destination,
      henId: form.henId || null,
      roosterId: form.roosterId || null,
      batchId: form.batchId || null,
      notes: form.notes || null,
    };
    if (form.destination === "venta" && form.pricePerKg) {
      payload.pricePerKg = Number(form.pricePerKg);
    }
    if (editing) payload.id = editing.id;

    const method = editing ? "PUT" : "POST";
    const res = await apiFetch("/api/sacrificio", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.error || "Error al guardar"); return; }
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "✏️ Editar Registro" : saleOnly ? "💰 Registrar Venta de Carne" : "🍗 Registrar Sacrificio"}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Tipo de ave" value={form.birdType} onChange={(e) => setForm({ ...form, birdType: e.target.value })}>
            {birdTypeOptions.map((t) => (
              <option key={t} value={t}>{birdTypeLabels[t] || t}</option>
            ))}
          </Select>
        </div>
        <Select label="Gallina" value={form.henId} onChange={(e) => handleHenSelect(e.target.value)}>
          <option value="">— Seleccione una gallina —</option>
          {hens.map((h) => (
            <option key={h.id} value={h.id}>🐔 {h.code} — {h.weight} kg{h.status === "recomendada_sacrificio" ? " ⚠️ Recomendada sacrificio" : ""}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Gallo" value={form.roosterId} onChange={(e) => handleRoosterSelect(e.target.value)}>
            <option value="">— Sin gallo —</option>
            {roosters.map((r) => (
              <option key={r.id} value={r.id}>🐓 {r.code}{r.weight ? ` — ${r.weight} kg` : ""}</option>
            ))}
          </Select>
          <Select label="Lote de pollos" value={form.batchId} onChange={(e) => handleBatchSelect(e.target.value)}>
            <option value="">— Sin lote —</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>📦 {b.code} ({b.currentQuantity} disponibles){b.status === "listo_sacrificio" ? " ✅" : ""}</option>
            ))}
          </Select>
        </div>
        {!form.henId && !form.roosterId && !form.batchId && (
          <p className="text-xs text-slate-500">Seleccione una gallina, un gallo o un lote (al menos uno).</p>
        )}
        {form.henId && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            ℹ️ Se seleccionó la gallina <strong>{hens.find((h) => h.id === form.henId)?.code}</strong> con peso <strong>{hens.find((h) => h.id === form.henId)?.weight} kg</strong>. El peso en canal se pre-llenó con su peso actual.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cantidad (aves)" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <Input label="Peso en canal (kg)" type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
        </div>
        {saleOnly ? (
          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">💰 Destino: <strong>Venta</strong> (fijo en esta vista)</div>
        ) : (
          <Select label="Destino" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
            <option value="consumo_propio">🏠 Consumo propio</option>
            <option value="venta">💰 Venta</option>
            <option value="donacion">🎁 Donación</option>
          </Select>
        )}
        {(form.destination === "venta" || saleOnly) && (
          <Input label="Precio por kg ($)" type="number" step="1" value={form.pricePerKg} onChange={(e) => setForm({ ...form, pricePerKg: e.target.value })} />
        )}
        {(form.destination === "venta" || saleOnly) && form.pricePerKg && form.weightKg && (
          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
            💵 Total venta: <strong className="text-xl">${(Number(form.pricePerKg) * Number(form.weightKg)).toLocaleString()}</strong>
            <span className="text-xs ml-2">({form.weightKg} kg × ${Number(form.pricePerKg).toLocaleString()}/kg)</span>
          </div>
        )}
        <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex gap-3">
          <Button onClick={save}>{editing ? "Actualizar" : "Registrar"}</Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Reescribir `src/app/(app)/produccion/_components/CarneTab.tsx` completo**

Reemplaza TODO el contenido del archivo (antes era la página de sacrificio con el modal inline; ahora la tabla/gráfica quedan igual pero el formulario viene del modal compartido):

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, EmptyState, StatCard } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/fetch";
import SlaughterFormModal, { SlaughterRecord, birdTypeLabels } from "@/components/SlaughterFormModal";

const destinationLabels: Record<string, string> = {
  consumo_propio: "🏠 Consumo propio",
  venta: "💰 Venta",
  donacion: "🎁 Donación",
};

export default function CarneTab() {
  const [records, setRecords] = useState<SlaughterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SlaughterRecord | null>(null);

  const load = useCallback(() => {
    apiFetch("/api/sacrificio").then((r) => r.json()).then((data) => {
      setRecords(Array.isArray(data) ? data : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: SlaughterRecord) => { setEditing(r); setModalOpen(true); };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro? Se restaurará el estado del ave y se revertirá el ingreso en finanzas si fue venta.")) return;
    await apiFetch(`/api/sacrificio?id=${id}`, { method: "DELETE" });
    load();
  };

  // Stats
  const totalBirds = records.reduce((s, r) => s + r.quantity, 0);
  const totalWeight = records.reduce((s, r) => s + Number(r.weightKg), 0);
  const totalRevenue = records.filter((r) => r.destination === "venta").reduce((s, r) => s + Number(r.totalAmount || 0), 0);
  const avgWeightPerBird = totalBirds > 0 ? (totalWeight / totalBirds).toFixed(1) : "0";

  // Chart data
  const chartMap = new Map<string, { fecha: string; kg: number; aves: number }>();
  records.forEach((r) => {
    const key = new Date(r.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
    const prev = chartMap.get(key) || { fecha: key, kg: 0, aves: 0 };
    chartMap.set(key, { fecha: key, kg: prev.kg + Number(r.weightKg), aves: prev.aves + r.quantity });
  });
  const chartData = Array.from(chartMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  return (
    <div>
      <PageHeader
        title="🍗 Producción de Carne"
        description="Registro de sacrificio de aves y producción de carne de la granja"
        actions={<Button onClick={openNew}>+ Registrar Sacrificio</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="🍗" label="Total Aves Sacrificadas" value={totalBirds} color="green" />
        <StatCard icon="⚖️" label="Peso Total (kg)" value={totalWeight.toFixed(1)} color="yellow" />
        <StatCard icon="💰" label="Ingresos por Venta" value={`$${totalRevenue.toLocaleString()}`} color="blue" />
        <StatCard icon="📊" label="Prom. kg/Ave" value={`${avgWeightPerBird} kg`} color="purple" />
      </div>

      {chartData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">📊 Producción de Carne</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={11} />
              <YAxis yAxisId="left" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} />
              <Tooltip />
              <Bar yAxisId="left" dataKey="kg" fill="#f97316" radius={[4, 4, 0, 0]} name="kg Carne" />
              <Bar yAxisId="right" dataKey="aves" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Aves" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : records.length === 0 ? (
          <EmptyState icon="🍗" message="No hay registros de sacrificio" />
        ) : (
          <Table headers={["Fecha", "Ave", "Tipo", "Peso (kg)", "Destino", "Precio/kg", "Total", ""]}>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(r.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3">
                  {r.hen ? (
                    <span className="text-sm font-medium text-blue-600">🐔 {r.hen.code}</span>
                  ) : r.rooster ? (
                    <span className="text-sm font-medium text-red-600">🐓 {r.rooster.code}</span>
                  ) : r.batch ? (
                    <span className="text-sm font-medium text-orange-600">📦 {r.batch.code}</span>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{birdTypeLabels[r.birdType] || r.birdType}</td>
                <td className="px-4 py-3">{r.weightKg} kg</td>
                <td className="px-4 py-3 text-sm">{destinationLabels[r.destination] || r.destination}</td>
                <td className="px-4 py-3 text-sm">{r.pricePerKg ? `$${Number(r.pricePerKg).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 font-bold text-green-600">{r.totalAmount ? `$${Number(r.totalAmount).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <SlaughterFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={() => { setModalOpen(false); load(); }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx eslint "src/components/SlaughterFormModal.tsx" "src/app/(app)/produccion/_components/CarneTab.tsx"`
Expected: sin errores.


---

### Task 5: Crear la pestaña `VentasCarneTab`

**Files:**
- Create: `src/app/(app)/ventas/_components/VentasCarneTab.tsx`

- [ ] **Step 1: Escribir el componente**

Lista solo sacrificios con `destination="venta"` y usa el modal compartido en modo `saleOnly`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, Table, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import SlaughterFormModal, { SlaughterRecord, birdTypeLabels } from "@/components/SlaughterFormModal";

const dateFmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });

export default function VentasCarneTab() {
  const [records, setRecords] = useState<SlaughterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SlaughterRecord | null>(null);

  const load = useCallback(() => {
    apiFetch("/api/sacrificio").then((r) => r.json()).then((data) => {
      setRecords(Array.isArray(data) ? data.filter((r: SlaughterRecord) => r.destination === "venta") : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: SlaughterRecord) => { setEditing(r); setModalOpen(true); };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta venta de carne? Se restaurará el estado del ave y se eliminará el ingreso en finanzas.")) return;
    await apiFetch(`/api/sacrificio?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalRevenue = records.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
  const totalKg = records.reduce((s, r) => s + Number(r.weightKg), 0);
  const totalBirds = records.reduce((s, r) => s + r.quantity, 0);
  const avgPrice = totalKg > 0 ? (totalRevenue / totalKg).toFixed(0) : "0";

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew}>+ Nueva Venta de Carne</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="💵" label="Ingresos Carne" value={`$${totalRevenue.toLocaleString()}`} color="green" />
        <StatCard icon="⚖️" label="Kg Vendidos" value={totalKg.toFixed(1)} color="yellow" />
        <StatCard icon="🍗" label="Aves Vendidas" value={totalBirds} color="blue" />
        <StatCard icon="📊" label="Precio Prom./kg" value={`$${avgPrice}`} color="purple" />
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : records.length === 0 ? (
          <EmptyState icon="🍗" message="Aún no hay ventas de carne. Registra un sacrificio con destino Venta." />
        ) : (
          <Table headers={["Fecha", "Ave", "Tipo", "Aves", "Kg", "Precio/kg", "Total", ""]}>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{dateFmt(r.date)}</td>
                <td className="px-4 py-3">
                  {r.hen ? (
                    <span className="text-sm font-medium text-blue-600">🐔 {r.hen.code}</span>
                  ) : r.rooster ? (
                    <span className="text-sm font-medium text-red-600">🐓 {r.rooster.code}</span>
                  ) : r.batch ? (
                    <span className="text-sm font-medium text-orange-600">📦 {r.batch.code}</span>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{birdTypeLabels[r.birdType] || r.birdType}</td>
                <td className="px-4 py-3 text-sm">{r.quantity}</td>
                <td className="px-4 py-3 text-sm">{Number(r.weightKg).toLocaleString()} kg</td>
                <td className="px-4 py-3 text-sm">{r.pricePerKg ? `$${Number(r.pricePerKg).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 font-bold text-green-600">{r.totalAmount ? `$${Number(r.totalAmount).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <SlaughterFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={() => { setModalOpen(false); load(); }}
        saleOnly
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint "src/app/(app)/ventas/_components/VentasCarneTab.tsx"`
Expected: sin errores.

---

### Task 6: Crear la pestaña `VentasGallinazaTab`

**Files:**
- Create: `src/app/(app)/ventas/_components/VentasGallinazaTab.tsx`

- [ ] **Step 1: Escribir el componente**

Autocontenido sobre `/api/gallinaza`; misma validación de stock y modal de venta que la página de gallinaza. La fecha de corte de 30 días se deriva de `lastAccumulatedDate` (regla de pureza de react-hooks, igual que en `GallinazaTab`):

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, Table, Modal, Input, Textarea, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";

interface ManureSale {
  id: string;
  date: string;
  quantityKg: string;
  pricePerKg: string;
  totalAmount: string;
  presentation: string | null;
  buyer: string | null;
  notes: string | null;
}

interface ManureData {
  inventory: { currentStockKg: number; lastAccumulatedDate: string };
  sales: ManureSale[];
}

const dateFmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });

export default function VentasGallinazaTab() {
  const [data, setData] = useState<ManureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saleModal, setSaleModal] = useState(false);
  const [error, setError] = useState("");
  const [saleForm, setSaleForm] = useState({ date: new Date().toISOString().split("T")[0], quantityKg: "", pricePerKg: "", presentation: "", buyer: "", notes: "" });
  const { values: buyerOptions } = useCatalog("comprador");

  const load = useCallback(() => {
    apiFetch("/api/gallinaza").then((r) => r.json()).then((d) => setData(d)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSale = async () => {
    setError("");
    const qty = Number(saleForm.quantityKg);
    if (data && qty > data.inventory.currentStockKg) {
      setError(`Stock insuficiente (disponible: ${data.inventory.currentStockKg.toFixed(2)} kg)`);
      return;
    }
    const res = await apiFetch("/api/gallinaza", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sale", ...saleForm, quantityKg: qty, pricePerKg: Number(saleForm.pricePerKg) }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Error al registrar la venta");
      return;
    }
    setSaleModal(false);
    setSaleForm({ date: new Date().toISOString().split("T")[0], quantityKg: "", pricePerKg: "", presentation: "", buyer: "", notes: "" });
    load();
  };

  const removeSale = async (id: string) => {
    if (!confirm("¿Eliminar esta venta? Se repondrá el stock y se eliminará el ingreso en finanzas.")) return;
    await apiFetch(`/api/gallinaza?saleId=${id}`, { method: "DELETE" });
    load();
  };

  if (loading || !data) {
    return <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>;
  }

  const cutoff = new Date(new Date(data.inventory.lastAccumulatedDate + "T12:00:00").getTime() - 30 * 86400000).toISOString().split("T")[0];
  const revenue30 = data.sales.filter((s) => s.date >= cutoff).reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const totalKgSold = data.sales.reduce((sum, s) => sum + Number(s.quantityKg), 0);
  const saleTotal = Number(saleForm.quantityKg) > 0 && Number(saleForm.pricePerKg) > 0
    ? (Number(saleForm.quantityKg) * Number(saleForm.pricePerKg)).toFixed(2)
    : "";

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setError(""); setSaleModal(true); }}>+ Nueva Venta de Gallinaza</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="💵" label="Ingresos (30 días)" value={`$${revenue30.toLocaleString()}`} color="green" />
        <StatCard icon="⚖️" label="Kg Vendidos (total)" value={totalKgSold.toFixed(1)} color="yellow" />
        <StatCard icon="🛒" label="Total Ventas" value={data.sales.length} color="blue" />
        <StatCard icon="📦" label="Stock Disponible" value={`${data.inventory.currentStockKg.toFixed(2)} kg`} color="purple" />
      </div>

      <Card>
        {data.sales.length === 0 ? (
          <EmptyState icon="🌱" message="Aún no hay ventas de gallinaza" />
        ) : (
          <Table headers={["Fecha", "Cantidad", "Precio/kg", "Presentación", "Comprador", "Total", ""]}>
            {data.sales.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{dateFmt(s.date)}</td>
                <td className="px-4 py-3 text-sm">{Number(s.quantityKg).toLocaleString()} kg</td>
                <td className="px-4 py-3 text-sm">${Number(s.pricePerKg).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">{s.presentation || "—"}</td>
                <td className="px-4 py-3 text-sm">{s.buyer || "—"}</td>
                <td className="px-4 py-3 font-bold text-green-600">${Number(s.totalAmount).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => removeSale(s.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={saleModal} onClose={() => setSaleModal(false)} title="💰 Registrar Venta de Gallinaza">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha" type="date" value={saleForm.date} onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cantidad (kg)" type="number" step="0.01" min="0" value={saleForm.quantityKg} onChange={(e) => setSaleForm({ ...saleForm, quantityKg: e.target.value })} placeholder={`Disp: ${data.inventory.currentStockKg.toFixed(2)} kg`} />
            <Input label="Precio por kg ($)" type="number" step="0.01" min="0" value={saleForm.pricePerKg} onChange={(e) => setSaleForm({ ...saleForm, pricePerKg: e.target.value })} placeholder="Ej: 800" />
          </div>
          <Input label="Presentación" value={saleForm.presentation} onChange={(e) => setSaleForm({ ...saleForm, presentation: e.target.value })} placeholder="Ej: Bulto 25 kg" list="ventas-gallinaza-presentaciones" />
          <datalist id="ventas-gallinaza-presentaciones">
            <option value="Bulto 25 kg" />
            <option value="Costal 50 kg" />
            <option value="Granel" />
          </datalist>
          <Input label="Comprador" value={saleForm.buyer} onChange={(e) => setSaleForm({ ...saleForm, buyer: e.target.value })} placeholder="Nombre del comprador" list="ventas-gallinaza-compradores" />
          <datalist id="ventas-gallinaza-compradores">
            {buyerOptions.map((b) => <option key={b} value={b} />)}
          </datalist>
          <Textarea label="Notas" value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} />
          {saleTotal && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
              🧮 Total: <strong className="text-xl">${Number(saleTotal).toLocaleString()}</strong> ({saleForm.quantityKg} kg × ${Number(saleForm.pricePerKg).toLocaleString()})
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={saveSale} disabled={!saleForm.quantityKg || !saleForm.pricePerKg}>Registrar Venta</Button>
            <Button variant="secondary" onClick={() => setSaleModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint "src/app/(app)/ventas/_components/VentasGallinazaTab.tsx"`
Expected: sin errores.

---

### Task 7: Integrar las 4 pestañas en el hub `/ventas`

**Files:**
- Modify: `src/app/(app)/ventas/page.tsx`

- [ ] **Step 1: Aplicar las 5 ediciones en `src/app/(app)/ventas/page.tsx`**

1) Después de la línea `import { apiFetch } from "@/lib/fetch";`, agregar:
```tsx
import VentasCarneTab from "./_components/VentasCarneTab";
import VentasGallinazaTab from "./_components/VentasGallinazaTab";
```

2) Reemplazar:
```tsx
type Tab = "huevos" | "aves";
```
por:
```tsx
type Tab = "huevos" | "aves" | "carne" | "gallinaza";
```

3) Reemplazar:
```tsx
        description="Gestión de ventas de huevos y aves"
```
por:
```tsx
        description="Gestión de ventas de huevos, aves, carne y gallinaza"
```

4) Reemplazar el cierre de la barra de pestañas:
```tsx
        <button onClick={() => setTab("aves")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "aves" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🐔 Aves
        </button>
      </div>
```
por:
```tsx
        <button onClick={() => setTab("aves")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "aves" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🐔 Aves
        </button>
        <button onClick={() => setTab("carne")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "carne" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🍗 Carne
        </button>
        <button onClick={() => setTab("gallinaza")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "gallinaza" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🌱 Gallinaza
        </button>
      </div>
```

5) Inmediatamente ANTES de la línea `      {/* ─── Modal: Egg Sale ─── */}`, insertar:
```tsx
      {/* ─── TAB: CARNE ─── */}
      {tab === "carne" && <VentasCarneTab />}

      {/* ─── TAB: GALLINAZA ─── */}
      {tab === "gallinaza" && <VentasGallinazaTab />}

```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint "src/app/(app)/ventas/page.tsx"`
Expected: sin errores.

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -b "galli_session=$COOKIE" "http://localhost:3001/ventas"
```
Expected: `200`.

---

### Task 8: Actualizar Sidebar y accesos rápidos del Dashboard

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Reemplazar el menú del Sidebar**

En `src/components/Sidebar.tsx`, reemplazar el arreglo `menuItems` completo:
```tsx
const menuItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/produccion", label: "Producción", icon: "🏭" },
  { href: "/ventas", label: "Ventas", icon: "💰" },
  { href: "/operaciones", label: "Operaciones", icon: "🔧" },
  { href: "/inventario", label: "Inventario Huevos", icon: "📦" },
  { href: "/egresos", label: "Egresos", icon: "📤" },
  { href: "/finanzas", label: "Finanzas", icon: "📈" },
  { href: "/catalogos", label: "Catálogos", icon: "🗂️" },
];
```

- [ ] **Step 2: Actualizar los accesos rápidos del Dashboard**

En `src/app/(app)/page.tsx`, reemplazar:
```tsx
          <a href="/huevos" className="flex flex-col items-center gap-2 p-4 bg-farm-50 rounded-lg hover:bg-farm-100 transition-colors">
```
por:
```tsx
          <a href="/produccion?tab=huevos" className="flex flex-col items-center gap-2 p-4 bg-farm-50 rounded-lg hover:bg-farm-100 transition-colors">
```

Reemplazar:
```tsx
          <a href="/alimentacion" className="flex flex-col items-center gap-2 p-4 bg-earth-100 rounded-lg hover:bg-earth-200 transition-colors">
```
por:
```tsx
          <a href="/produccion?tab=alimentacion" className="flex flex-col items-center gap-2 p-4 bg-earth-100 rounded-lg hover:bg-earth-200 transition-colors">
```

Reemplazar:
```tsx
          <a href="/gallinas" className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
```
por:
```tsx
          <a href="/produccion?tab=gallinas" className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
```

Los enlaces a `/inventario` y `/ventas` se dejan sin cambios.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint "src/components/Sidebar.tsx" "src/app/(app)/page.tsx"`
Expected: sin errores.

---

### Task 9: Verificación integral

**Files:** ninguno (solo verificación)

- [ ] **Step 1: TypeScript, pruebas y lint**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx vitest run`
Expected: todas las pruebas pasan (la suite existente opera sobre APIs; no debe haber regresiones).

- [ ] **Step 2: Verificar las 9 redirecciones**

Run:
```bash
cd "/Users/espaciosplus/Downloads/Sistema Gallinero"
COOKIE=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' -c - | grep galli_session | awk '{print $NF}')
for p in huevos sacrificio gallinas pollos gallinaza incubacion alimentacion mantenimiento sanidad; do
  echo "$p -> $(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" -b "galli_session=$COOKIE" "http://localhost:3001/$p")"
done
```
Expected: cada línea muestra `307` (o `308`) con `redirect_url` apuntando a `/produccion?tab=...` o `/operaciones?tab=...` según la tabla del Task 1/Task 3.

- [ ] **Step 3: Verificar los 3 hubs con varias pestañas**

Run:
```bash
for t in huevos carne gallinas pollos gallinaza incubacion alimentacion; do
  echo "$t -> $(curl -s -o /dev/null -w "%{http_code}" -b "galli_session=$COOKIE" "http://localhost:3001/produccion?tab=$t")"
done
for t in mantenimiento sanidad; do
  echo "$t -> $(curl -s -o /dev/null -w "%{http_code}" -b "galli_session=$COOKIE" "http://localhost:3001/operaciones?tab=$t")"
done
echo "ventas -> $(curl -s -o /dev/null -w "%{http_code}" -b "galli_session=$COOKIE" "http://localhost:3001/ventas")"
echo "dashboard -> $(curl -s -o /dev/null -w "%{http_code}" -b "galli_session=$COOKIE" "http://localhost:3001/")"
```
Expected: todos `200`.

- [ ] **Step 4: Verificación E2E de la pestaña Carne de Ventas (API)**

Crea una venta de carne por API y confirma que aparece filtrada en la vista de ventas y que genera transacción en finanzas; luego elimínala:

```bash
# Buscar un lote activo o gallina disponible
curl -s -b "galli_session=$COOKIE" http://localhost:3001/api/lotes-pollos
```
Con un `batchId` de estado `activo` o `listo_sacrificio` (si no hay lote, usa un `henId` disponible de `/api/gallinas`):

```bash
BATCH=<batchId>
RES=$(curl -s -b "galli_session=$COOKIE" -X POST http://localhost:3001/api/sacrificio -H "Content-Type: application/json" -d "{\"date\":\"$(date +%F)\",\"birdType\":\"pollo\",\"quantity\":1,\"weightKg\":2.5,\"destination\":\"venta\",\"pricePerKg\":8000,\"batchId\":\"$BATCH\"}")
echo "$RES"
ID=$(echo "$RES" | sed -E 's/.*"id":"([^"]+)".*/\1/')
curl -s -b "galli_session=$COOKIE" http://localhost:3001/api/sacrificio | grep -o '"destination":"venta"' | head -1
curl -s -b "galli_session=$COOKIE" http://localhost:3001/api/finanzas | grep -o '"Venta de carne"' | head -1
curl -s -b "galli_session=$COOKIE" -X DELETE "http://localhost:3001/api/sacrificio?id=$ID"
```
Expected: el POST responde `201` con `totalAmount: "20000.00"`; el GET muestra el registro con destino venta; finanzas contiene `Venta de carne`; el DELETE responde `{"ok":true}`.

- [ ] **Step 5: Confirmación visual final**

Abrir en el navegador (puerto 3001): `/produccion` (cambiar por las 7 pestañas), `/ventas` (4 pestañas) y `/operaciones` (2 pestañas). Verificar que la barra de pestañas se resalta correctamente, que la URL cambia con `?tab=` y que cada pestaña muestra el contenido de su módulo original.
