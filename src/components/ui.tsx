"use client";

import { ReactNode, useState, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { HelpCircle, Lightbulb, X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";

/** Parse help text that may contain \n (real newlines or literal \\n) and • bullets into JSX */
function renderHelpText(text: string) {
  // Normalize: replace literal \n (from double-escaping) with real newlines
  const normalized = text.replace(/\\n/g, "\n");
  const parts = normalized.split(/\n/).filter(p => p.trim());
  if (parts.length <= 1) return <>{text}</>;
  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        const trimmed = part.replace(/^[•\-]\s*/, "").trim();
        const isBullet = part.trim().startsWith("•") || part.trim().startsWith("-");
        return (
          <div key={i} className="flex gap-2">
            {isBullet && <span className="text-blue-500 flex-shrink-0">•</span>}
            <span>{trimmed}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tooltip ───
export function Tooltip({ text, children }: { text: string; children?: ReactNode }) {
  if (!text) return <>{children}</>;
  return (
    <span className="relative inline-flex items-center group">
      {children || (
        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold cursor-help select-none">?</span>
      )}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className="block w-56 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-normal leading-relaxed shadow-lg text-left whitespace-pre-line">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      </span>
    </span>
  );
}

function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      {help && <Tooltip text={help} />}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon, color = "green" }: { label: string; value: string | number; icon: string | ReactNode; color?: string }) {
  const colorMap: Record<string, string> = {
    green: "from-green-500 to-green-700",
    yellow: "from-farm-400 to-farm-600",
    blue: "from-blue-500 to-blue-700",
    red: "from-red-500 to-red-700",
    purple: "from-purple-500 to-purple-700",
    earth: "from-earth-400 to-earth-600",
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorMap[color] || colorMap.green} flex items-center justify-center text-white shrink-0 shadow-xs`}>
        {typeof icon === "string" ? <AppIcon icon={icon} className="w-6 h-6 text-white" /> : icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, help }: { title: string; description?: string; actions?: ReactNode; help?: string }) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          {description && <p className="text-slate-500 mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {help && (
            <button
              onClick={() => setHelpOpen(!helpOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{helpOpen ? "Ocultar ayuda" : "Ayuda"}</span>
            </button>
          )}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </div>
      {help && helpOpen && (
        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 leading-relaxed">
          <div className="flex gap-2.5">
            <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>{renderHelpText(help)}</div>
          </div>
          <button
            onClick={() => setHelpOpen(false)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <span>Cerrar</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "success" }) {
  const variants: Record<string, string> = {
    primary: "bg-green-600 hover:bg-green-700 text-white",
    secondary: "bg-slate-200 hover:bg-slate-300 text-slate-700",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  };
  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ label, help, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; help?: string }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1"><FieldLabel label={label} help={help} /></label>}
      <input
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        {...props}
      />
    </div>
  );
}

export function Select({ label, help, children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; help?: string }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1"><FieldLabel label={label} help={help} /></label>}
      <select
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function Textarea({ label, help, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; help?: string }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1"><FieldLabel label={label} help={help} /></label>}
      <textarea
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        rows={3}
        {...props}
      />
    </div>
  );
}

export function Badge({ children, color = "green" }: { children: ReactNode; color?: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    purple: "bg-purple-100 text-purple-800",
    gray: "bg-gray-100 text-gray-800",
    orange: "bg-orange-100 text-orange-800",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[color] || colorMap.green}`}>
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 font-medium text-slate-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ icon, message }: { icon: string | ReactNode; message: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {typeof icon === "string" ? <AppIcon icon={icon} className="w-7 h-7" /> : icon}
      </div>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
