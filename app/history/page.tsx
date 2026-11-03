import { Suspense } from "react";
import { HistoryScreen } from "@/components/HistoryScreen";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Đang mở lịch sử…</p>}>
      <HistoryScreen />
    </Suspense>
  );
}
