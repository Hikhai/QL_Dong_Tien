"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { formatSignedVnd, formatVnd } from "@/lib/format";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)]", className)}>
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "soft" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]",
    soft: "bg-[var(--brand-soft)] text-[var(--brand-dark)]",
    ghost: "bg-transparent text-[var(--ink)] hover:bg-black/5",
    danger: "bg-rose-50 text-[var(--expense)] hover:bg-rose-100",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0 max-w-full">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export const fieldClass =
  "block w-full min-w-0 max-w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none transition focus:border-[var(--brand)]";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet-veil absolute inset-0 bg-stone-900/45" aria-label="Đóng" onClick={onClose} />
      <div className="sheet-panel relative z-10 flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-[var(--card)] shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-2 hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Money({
  value,
  signed = false,
  className,
}: {
  value: number;
  signed?: boolean;
  className?: string;
}) {
  const tone = value > 0 ? "text-[var(--income)]" : value < 0 ? "text-[var(--expense)]" : "text-[var(--ink)]";
  return <span className={cn("tabular", signed ? tone : undefined, className)}>{signed ? formatSignedVnd(value) : formatVnd(value)}</span>;
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-[var(--expense)]">
      {children}
    </p>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--line)] px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}
