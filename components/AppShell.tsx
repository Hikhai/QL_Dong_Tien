"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, Handshake, LayoutDashboard, PieChart, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/components/Store";
import { cn } from "@/components/ui";

const tabs = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/flow", label: "Thu chi", icon: CalendarDays },
  { href: "/debts", label: "Công nợ", icon: Handshake },
  { href: "/budget", label: "Ngân sách", icon: PieChart },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user } = useStore();
  const onHistory = path.startsWith("/history");
  const title = path.startsWith("/flow")
    ? "Dòng tiền"
    : path.startsWith("/debts")
      ? "Công nợ"
      : path.startsWith("/budget")
        ? "Ngân sách"
        : path.startsWith("/settings")
          ? "Cài đặt"
          : path.startsWith("/history")
            ? "Lịch sử"
            : "Tổng quan";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[rgba(239,236,230,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          {onHistory ? (
            <button
              type="button"
              aria-label="Quay lại"
              className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[var(--ink)]"
              onClick={() => {
                if (window.history.length > 1) router.back();
                else router.push("/");
              }}
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Thu Chi · {user.username}</p>
            <h1 className="text-xl font-semibold leading-tight">{title}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-lg overflow-x-hidden px-4 pb-32 pt-4">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[rgba(255,252,248,0.94)] backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((tab) => {
            const active = tab.href === "/" ? path === "/" : path.startsWith(tab.href);
            const Glyph = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium",
                  active ? "text-[var(--brand)]" : "text-[var(--muted)]",
                )}
              >
                <Glyph size={20} strokeWidth={active ? 2.2 : 1.8} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
