"use client";

import { Select } from "@/components/ui";
import { LOCATION_TYPE_LABELS, useFarmLocations } from "@/lib/useFarmLocations";

export default function FarmLocationSelect({
  value,
  onChange,
  label = "Lugar de manejo",
  allowUnassigned = false,
  help = "Indica el lugar relacionado con este registro.",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  allowUnassigned?: boolean;
  help?: string;
}) {
  const { locations, loading } = useFarmLocations();
  const placeholder = loading ? "Cargando lugares…"
    : allowUnassigned ? "Sin lugar específico"
    : locations.length ? "Selecciona un lugar…" : "Primero crea un lugar de manejo";
  return (
    <Select label={label} value={value} onChange={(event) => onChange(event.target.value)} help={help}>
      <option value="">{placeholder}</option>
      {locations.map((location) => (
        <option key={location.id} value={location.id}>{location.name} · {LOCATION_TYPE_LABELS[location.type] || location.type}</option>
      ))}
    </Select>
  );
}
