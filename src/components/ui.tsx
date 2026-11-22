"use client";

import {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import {
  HeroActionAnchor,
  HeroActionButton,
  HeroActionLink,
  HeroBanner,
  heroActionClassName,
  type HeroActionTone,
} from "@/components/HeroBanner";
import type { HeroThemeKey } from "@/lib/hero-themes";
import { resolveDefaultFieldHelp } from "@/lib/field-help";

export {
  HeroActionAnchor,
  HeroActionButton,
  HeroActionLink,
  heroActionClassName,
  type HeroActionTone,
};

// ─── Tooltip (accesible por mouse, teclado y toque en celular) ───
export function Tooltip({ text, children }: { text: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!text) return <>{children}</>;
  return (
    <span ref={rootRef} className="relative inline-flex items-center group">
      {children ? (
        <span
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((prev) => !prev);
            }
          }}
          className="inline-flex items-center cursor-help"
        >
          {children}
        </span>
      ) : (
        <button
          type="button"
          aria-label={text}
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 text-[10px] font-bold cursor-help select-none focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors shrink-0"
        >
          ?
        </button>
      )}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[60] transition-opacity duration-150 ${
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      >
        <span className="block w-56 max-w-[min(15rem,calc(100vw-2rem))] px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-normal leading-relaxed shadow-xl text-left whitespace-pre-line">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      </span>
    </span>
  );
}

function FieldLabelRow({ label, help }: { label: string; help?: string }) {
  const resolvedHelp = help !== undefined ? help : resolveDefaultFieldHelp(label);
  return (
    <div className="flex items-center gap-1 mb-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {resolvedHelp && <Tooltip text={resolvedHelp} />}
    </div>
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5 flex items-center gap-2.5 sm:gap-4 min-w-0">
      <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${colorMap[color] || colorMap.green} flex items-center justify-center text-white shrink-0 shadow-xs`}>
        {typeof icon === "string" ? <AppIcon icon={icon} className="w-4 h-4 sm:w-6 sm:h-6 text-white" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base sm:text-2xl font-bold text-slate-800 truncate">{value}</p>
        <p className="text-xs sm:text-sm text-slate-500 leading-tight line-clamp-2">{label}</p>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  help,
  theme,
  eyebrow,
  icon,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  help?: string;
  theme?: HeroThemeKey;
  eyebrow?: string;
  icon?: string | ReactNode;
}) {
  return (
    <HeroBanner
      theme={theme}
      title={title}
      description={description}
      actions={actions}
      help={help}
      eyebrow={eyebrow}
      icon={icon}
    />
  );
}

export function Button({
  children,
  variant = "primary",
  touchSize = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "success";
  touchSize?: "default" | "field";
}) {
  const variants: Record<string, string> = {
    primary: "bg-green-600 hover:bg-green-700 text-white",
    secondary: "bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  };
  const sizeCls = touchSize === "field" ? "min-h-[48px] px-5 py-3 text-base font-semibold" : "px-4 py-2 text-sm font-medium";
  return (
    <button
      className={`rounded-lg transition-colors disabled:opacity-50 ${sizeCls} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  help,
  touchSize = "default",
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  help?: string;
  touchSize?: "default" | "field";
}) {
  const inputCls =
    touchSize === "field"
      ? "min-h-[48px] px-3.5 py-2.5 text-base font-medium border-slate-400 text-slate-900"
      : "px-3 py-2 text-sm border-slate-300";
  return (
    <div className={className}>
      {label && <FieldLabelRow label={label} help={help} />}
      <input
        className={`w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${inputCls}`}
        {...props}
      />
    </div>
  );
}

export function Select({ label, help, children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; help?: string }) {
  return (
    <div className={className}>
      {label && <FieldLabelRow label={label} help={help} />}
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
      {label && <FieldLabelRow label={label} help={help} />}
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
