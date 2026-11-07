"use client";

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}

/**
 * Campo de búsqueda reutilizable para filtrar tablas.
 * Es controlado: cada página mantiene el estado y filtra su propio arreglo.
 */
export default function TableSearch({
  value,
  onChange,
  placeholder = "Buscar en la tabla...",
  resultCount,
  totalCount,
  className = "",
}: TableSearchProps) {
  const showCount =
    value.trim().length > 0 &&
    typeof resultCount === "number" &&
    typeof totalCount === "number";

  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${className}`}>
      <div className="relative w-full sm:max-w-sm">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          🔍
        </span>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
          aria-label={placeholder}
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Limpiar búsqueda"
          >
            ✕
          </button>
        )}
      </div>
      {showCount && (
        <span className="text-xs text-slate-500">
          {resultCount} de {totalCount} registros
        </span>
      )}
    </div>
  );
}
