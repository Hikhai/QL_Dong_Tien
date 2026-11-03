"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DebtDetail } from "@/components/DebtDetail";

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  return <DebtDetail id={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Đang mở khoản nợ…</p>}>
      <Detail />
    </Suspense>
  );
}
