"use client";

import {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
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
          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] hover:bg-[var(--iw-semantic-action-primary)] hover:text-[var(--iw-semantic-action-primary-text)] text-[var(--iw-semantic-action-primary)] text-[11px] font-bold cursor-help select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iw-semantic-focus-ring)] transition-colors shrink-0"
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
        <span className="block w-56 max-w-[min(15rem,calc(100vw-2rem))] px-3 py-2 rounded-[var(--iw-radius-control)] bg-[var(--iw-color-ink-strong)] text-[var(--iw-semantic-text-inverse)] text-xs font-normal leading-relaxed shadow-[var(--iw-shadow-popover)] text-left whitespace-pre-line">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--iw-color-ink-strong)]" />
        </span>
      </span>
    </span>
  );
}

function FieldLabelRow({
  label,
  help,
  htmlFor,
}: {
  label: string;
  help?: string;
  htmlFor?: string;
}) {
  const resolvedHelp = help !== undefined ? help : resolveDefaultFieldHelp(label);
  return (
    <div className="flex items-center gap-1 mb-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[var(--iw-semantic-text-primary)]"
      >
        {label}
      </label>
      {resolvedHelp && <Tooltip text={resolvedHelp} />}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-[var(--iw-semantic-bg-surface)] rounded-2xl shadow-[var(--iw-shadow-card)] border border-[var(--iw-semantic-border-default)] p-5 text-[var(--iw-semantic-text-primary)] ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  color = "green",
}: {
  label: string;
  value: string | number;
  icon: string | ReactNode;
  color?: string;
}) {
  const iconBoxMap: Record<string, string> = {
    green: "bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)] border-[var(--iw-semantic-border-default)]",
    yellow: "bg-[var(--iw-color-paper)] text-[var(--iw-color-ink-strong)] border-[var(--iw-semantic-accent-ochre)]/40",
    blue: "bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-status-info)] border-[var(--iw-semantic-status-info)]/30",
    red: "bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-status-danger)] border-[var(--iw-semantic-status-danger)]/30",
    purple: "bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-primary)] border-[var(--iw-semantic-border-default)]",
    earth: "bg-[var(--iw-color-paper)] text-[var(--iw-semantic-text-primary)] border-[var(--iw-semantic-accent-ochre)]/40",
  };

  return (
    <div className="bg-[var(--iw-semantic-bg-surface)] rounded-2xl shadow-[var(--iw-shadow-card)] border border-[var(--iw-semantic-border-default)] p-3 sm:p-5 flex items-center gap-2.5 sm:gap-4 min-w-0">
      <div
        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--iw-radius-control)] border flex items-center justify-center shrink-0 ${
          iconBoxMap[color] || iconBoxMap.green
        }`}
      >
        {typeof icon === "string" ? (
          <AppIcon icon={icon} className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          icon
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base sm:text-2xl font-bold text-[var(--iw-semantic-text-primary)] tabular-nums truncate">
          {value}
        </p>
        <p className="text-xs sm:text-sm text-[var(--iw-semantic-text-secondary)] leading-tight line-clamp-2">
          {label}
        </p>
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
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  touchSize?: "default" | "field";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] text-[var(--iw-semantic-action-primary-text)] border border-transparent",
    secondary:
      "bg-[var(--iw-semantic-action-secondary)] hover:bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-secondary-text)] border border-[var(--iw-semantic-action-secondary-border)]",
    outline:
      "bg-transparent hover:bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-primary)] border border-[var(--iw-semantic-border-default)]",
    ghost:
      "bg-transparent hover:bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-action-primary)] border border-transparent",
    danger:
      "bg-[var(--iw-semantic-status-danger)] hover:brightness-90 text-[var(--iw-semantic-text-inverse)] border border-transparent",
    success:
      "bg-[var(--iw-semantic-status-success)] hover:brightness-90 text-[var(--iw-semantic-text-inverse)] border border-transparent",
  };
  const sizeCls =
    touchSize === "field"
      ? "min-h-[48px] px-5 py-3 text-base font-semibold"
      : "min-h-[40px] px-4 py-2 text-sm font-medium";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--iw-radius-control)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iw-semantic-focus-ring)] focus-visible:ring-offset-1 ${sizeCls} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  help,
  error,
  touchSize = "default",
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  help?: string;
  error?: string;
  touchSize?: "default" | "field";
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const inputCls =
    touchSize === "field"
      ? "min-h-[48px] px-3.5 py-2.5 text-base font-medium"
      : "min-h-[40px] px-3 py-2 text-sm";
  const borderCls = error
    ? "border-[var(--iw-semantic-status-danger)]"
    : "border-[var(--iw-semantic-border-input)]";
  return (
    <div className={className}>
      {label && <FieldLabelRow label={label} help={help} htmlFor={fieldId} />}
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full border ${borderCls} rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] placeholder:text-[var(--iw-semantic-text-secondary)]/75 focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)] focus:border-transparent ${inputCls}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-[var(--iw-semantic-status-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  help,
  error,
  touchSize = "default",
  children,
  className = "",
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  help?: string;
  error?: string;
  touchSize?: "default" | "field";
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const selectCls =
    touchSize === "field"
      ? "min-h-[48px] px-3.5 py-2.5 text-base font-medium"
      : "min-h-[40px] px-3 py-2 text-sm";
  const borderCls = error
    ? "border-[var(--iw-semantic-status-danger)]"
    : "border-[var(--iw-semantic-border-input)]";
  return (
    <div className={className}>
      {label && <FieldLabelRow label={label} help={help} htmlFor={fieldId} />}
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full border ${borderCls} rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)] focus:border-transparent ${selectCls}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-[var(--iw-semantic-status-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Textarea({
  label,
  help,
  error,
  className = "",
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  help?: string;
  error?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const borderCls = error
    ? "border-[var(--iw-semantic-status-danger)]"
    : "border-[var(--iw-semantic-border-input)]";
  return (
    <div className={className}>
      {label && <FieldLabelRow label={label} help={help} htmlFor={fieldId} />}
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full px-3 py-2 border ${borderCls} rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] text-sm text-[var(--iw-semantic-text-primary)] placeholder:text-[var(--iw-semantic-text-secondary)]/75 focus:outline-none focus:ring-2 focus:ring-[var(--iw-semantic-focus-ring)] focus:border-transparent`}
        rows={3}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-[var(--iw-semantic-status-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Badge({ children, color = "green" }: { children: ReactNode; color?: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)] border border-[var(--iw-semantic-border-default)]",
    success: "bg-[var(--iw-semantic-status-success)] text-[var(--iw-semantic-text-inverse)]",
    yellow: "bg-[var(--iw-color-paper)] text-[var(--iw-semantic-status-warning)] border border-[var(--iw-semantic-accent-ochre)]/40",
    warning: "bg-[var(--iw-semantic-status-warning)] text-[var(--iw-semantic-text-inverse)]",
    red: "bg-[var(--iw-semantic-status-danger)] text-[var(--iw-semantic-text-inverse)]",
    danger: "bg-[var(--iw-semantic-status-danger)] text-[var(--iw-semantic-text-inverse)]",
    blue: "bg-[var(--iw-semantic-status-info)] text-[var(--iw-semantic-text-inverse)]",
    info: "bg-[var(--iw-semantic-status-info)] text-[var(--iw-semantic-text-inverse)]",
    purple: "bg-[var(--iw-semantic-bg-page)] text-[var(--iw-semantic-text-primary)] border border-[var(--iw-semantic-border-default)]",
    gray: "bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)] border border-[var(--iw-semantic-border-default)]",
    neutral: "bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)] border border-[var(--iw-semantic-border-default)]",
    orange: "bg-[var(--iw-color-paper)] text-[var(--iw-semantic-status-warning)] border border-[var(--iw-semantic-accent-terracotta)]/45",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        colorMap[color] || colorMap.green
      }`}
    >
      {children}
    </span>
  );
}

const DIALOG_WIDTH_CLASSES = {
  sm: "w-[min(calc(100vw-1.5rem),28rem)]",
  md: "w-[min(calc(100vw-1.5rem),32rem)]",
  lg: "w-[min(calc(100vw-1.5rem),42rem)]",
  xl: "w-[min(calc(100vw-1.5rem),56rem)]",
  "2xl": "w-[min(calc(100vw-1.5rem),64rem)]",
} as const;

export type DialogSize = keyof typeof DIALOG_WIDTH_CLASSES;

function isPointerOutsideElement(
  event: { clientX: number; clientY: number },
  element: HTMLElement,
): boolean {
  const rect = element.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

const emptySubscribe = () => () => {};

/** Devuelve `true` solo tras hidratar en el cliente, evitando desajustes SSR en portales. */
export function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * Renderiza un `<dialog>` nativo promovido al top layer (`showModal()`) y portaleado
 * a `document.body`, evitando recortes por ancestros con `backdrop-filter`, `overflow`
 * o `transform` (como la barra superior fija).
 */
export function PortalDialog({
  open,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  size = "md",
  variant = "center",
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  size?: DialogSize;
  variant?: "center" | "top";
  className?: string;
  children: ReactNode;
}) {
  const mounted = useIsClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const supportsShowModal = typeof dialog.showModal === "function";
    if (supportsShowModal) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      }
    } else if (!dialog.hasAttribute("open")) {
      dialog.setAttribute("open", "");
    }

    const handleClose = () => {
      dialog.returnValue = "";
      onCloseRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!supportsShowModal && event.key === "Escape") {
        onCloseRef.current();
      }
    };

    dialog.addEventListener("close", handleClose);
    if (!supportsShowModal) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      if (!supportsShowModal) {
        window.removeEventListener("keydown", handleKeyDown);
      }
      if (dialog.open && typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    };
  }, [open, mounted]);

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, string>)}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onPointerDown={(event) => {
        const dialog = dialogRef.current;
        if (!dialog || typeof HTMLDialogElement === "undefined" || "closedBy" in HTMLDialogElement.prototype) {
          pressedOutsideRef.current = false;
          return;
        }
        pressedOutsideRef.current = isPointerOutsideElement(event, dialog);
      }}
      onPointerUp={(event) => {
        const dialog = dialogRef.current;
        if (!dialog || typeof HTMLDialogElement === "undefined" || "closedBy" in HTMLDialogElement.prototype) return;
        const shouldClose = pressedOutsideRef.current && isPointerOutsideElement(event, dialog);
        pressedOutsideRef.current = false;
        if (shouldClose) {
          if (typeof dialog.close === "function" && dialog.open) {
            dialog.close();
          } else {
            onCloseRef.current();
          }
        }
      }}
      className={`iw-dialog ${variant === "top" ? "iw-dialog--top" : ""} ${DIALOG_WIDTH_CLASSES[size]} rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] shadow-[var(--iw-shadow-popover)] overflow-hidden open:flex open:flex-col sm:max-h-[90dvh] ${className}`}
    >
      {children}
    </dialog>,
    document.body,
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: DialogSize;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <PortalDialog open={open} onClose={onClose} ariaLabelledBy={headingId} size={size}>
      <div className="shrink-0 flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-lg font-semibold text-[var(--iw-semantic-text-primary)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--iw-semantic-text-secondary)]">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--iw-radius-control)] text-[var(--iw-semantic-text-secondary)] hover:bg-[var(--iw-semantic-bg-page)] hover:text-[var(--iw-semantic-text-primary)] cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 text-[var(--iw-semantic-text-primary)]">
        {children}
      </div>
    </PortalDialog>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)]">
      <table className="w-full text-sm tabular-nums text-[var(--iw-semantic-text-primary)]">
        <thead>
          <tr className="bg-[var(--iw-semantic-bg-subtle)] border-b border-[var(--iw-semantic-border-default)]">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-[var(--iw-semantic-text-secondary)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--iw-semantic-border-default)]/70">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: string | ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)]">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-action-primary)]">
        {typeof icon === "string" ? <AppIcon icon={icon} className="w-7 h-7" /> : icon}
      </div>
      <p className="text-sm font-medium text-[var(--iw-semantic-text-secondary)]">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
