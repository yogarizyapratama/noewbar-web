"use client";

/**
 * Shared UI kit. Every surface in the product renders through these primitives
 * so spacing, hierarchy and states are fixed in one place instead of ~2500
 * lines of inline Tailwind spread across three monolithic pages.
 *
 * Rules that hold for everything here:
 * - Radius comes from the token scale (8px default, 4px badges). No pills.
 * - A surface earns a shadow only when it genuinely floats (R: layering).
 * - Loading, empty and error are first-class components, not afterthoughts.
 * - No em dash (U+2014) in any user-visible string.
 */

import { useEffect, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Inbox, Loader2, SearchX } from "lucide-react";

export { cn } from "@/lib/utils";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ button */

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  accent: "btn-accent",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
} & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      className={cn(BUTTON_VARIANT[variant], size === "sm" && "btn-sm", className)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Icon-only control. Always needs an aria-label (R-32 / a11y). */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: { label: string } & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      aria-label={label}
      title={rest.title ?? label}
      className={cn("icon-btn", className)}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- card */

export function Card({
  variant = "default",
  className,
  children,
  ...rest
}: {
  variant?: "default" | "flat" | "sunken" | "overlay";
} & ComponentPropsWithoutRef<"div">) {
  const base =
    variant === "flat"
      ? "card-flat"
      : variant === "sunken"
        ? "card-sunken"
        : variant === "overlay"
          ? "card-overlay"
          : "card";
  return (
    <div {...rest} className={cn(base, className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-5 py-4",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded bg-ink-50 text-ink-500">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-6 text-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t border-ink-200 bg-ink-50/60 px-5 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- badge */

export type Tone = "neutral" | "signal" | "warn" | "danger";

const BADGE_TONE: Record<Tone, string> = {
  neutral: "badge-neutral",
  signal: "badge-signal",
  warn: "badge-warn",
  danger: "badge-danger",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(BADGE_TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** A green dot means a probe confirmed the state. Pulsates with modern radar ping. */
export function StatusDot({ ok, pulse = true }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            ok ? "bg-emerald-400" : "bg-rose-400"
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          ok ? "bg-emerald-500 shadow-2xs shadow-emerald-500/50" : "bg-rose-500 shadow-2xs shadow-rose-500/50"
        )}
      />
    </span>
  );
}

/* -------------------------------------------------------------------- stat */

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  const valueTone =
    tone === "signal"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-rose-600"
        : tone === "warn"
          ? "text-amber-600"
          : "text-slate-900";
  return (
    <Card className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && (
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100/80 text-slate-600">
            {icon}
          </span>
        )}
      </div>
      <p className={cn("mt-2 font-mono text-2xl font-extrabold tracking-tight tnum", valueTone)}>{value}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </Card>
  );
}

/* ------------------------------------------------------------ page headers */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-2 border-b border-slate-200/60">
      <div className="min-w-0">
        {(eyebrow || icon) && (
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/90 px-3 py-0.5 text-2xs font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200/60 shadow-2xs">
              {icon && <span className="text-emerald-600">{icon}</span>}
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- data states */

/** R-27: every data view gets empty, loading and error. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-lg border",
          tone === "danger"
            ? "border-danger/20 bg-danger-wash text-danger"
            : "border-ink-200 bg-ink-50 text-ink-400"
        )}
      >
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-500">{description}</p>
      )}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Names the failing dependency instead of showing a blank panel. */
export function ErrorState({
  title = "Gagal memuat data",
  description,
  action,
  compact = false,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-start gap-2.5 rounded border border-danger/25 bg-danger-wash px-3 py-2.5 text-sm text-danger">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {description && <p className="mt-0.5 text-xs leading-relaxed">{description}</p>}
        </div>
      </div>
    );
  }
  return (
    <Card className="border-danger/25 bg-danger-wash">
      <EmptyState
        tone="danger"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        title={title}
        description={description}
        action={action}
      />
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden="true" />;
}

/** Skeleton block that mirrors the shape of the content it replaces. */
export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-live="polite">
      <span className="sr-only">Memuat data</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- tabs */

export type SegmentedItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
};

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  size = "md",
}: {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("segmented", className)} role="tablist" aria-label={label}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(item.id)}
            className={cn("segmented-item", size === "sm" && "min-h-[34px] px-2.5")}
          >
            {item.icon}
            {item.label}
            {typeof item.count === "number" && item.count > 0 && (
              <span className="ml-0.5 rounded-sm bg-warn-wash px-1 font-mono text-[10px] font-bold text-warn">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

export function TextField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...rest
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
} & ComponentPropsWithoutRef<"input">) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="ml-1.5 font-normal normal-case text-ink-400">(opsional)</span>}
      </label>
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-help` : undefined}
        className={cn("field", error && "border-danger focus:ring-danger/15")}
      />
      {(hint || error) && (
        <p
          id={`${id}-help`}
          className={cn("hint", error ? "text-danger" : "text-ink-500")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- misc */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-ink-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-500">
      {children}
    </kbd>
  );
}

/** Thin meter for quotas and progress. Reads as data, not decoration. */
export function Meter({
  value,
  max,
  tone = "neutral",
  label,
}: {
  value: number;
  max: number;
  tone?: Tone;
  label?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const bar =
    tone === "signal"
      ? "bg-signal"
      : tone === "danger"
        ? "bg-danger"
        : tone === "warn"
          ? "bg-warn"
          : "bg-ink-400";
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-sm bg-ink-100"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className={cn("h-full rounded-sm transition-[width]", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Named "no results" state, distinct from "nothing exists yet". */
export function NoResults({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<SearchX className="h-5 w-5" aria-hidden="true" />}
      title="Tidak ada hasil"
      description={`Tidak ada item yang cocok dengan "${query}".`}
    />
  );
}

/** Shown while a long-running probe runs, without jumping the layout. */
export function InlineLoading({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-ink-500" role="status" aria-live="polite">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}

/* ------------------------------------------------------------------ modal / portal */

/**
 * Attaches content directly to document.body so modals and overlays
 * span the true 100vw x 100vh viewport without being trapped inside
 * parent flex containers, transformed elements, or sidebar stacking contexts.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function Modal({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onClose) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm animate-fade-up",
          className
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

/**
 * Generic confirmation modal. Replaces native window.confirm/alert so destructive
 * actions always go through an in-app dialog (consistent styling, no browser chrome).
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="card w-full max-w-sm p-5">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-600">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "accent"} size="sm" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export { timeAgo, rupiah } from "@/lib/utils";

