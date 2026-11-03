"use client";

import { useParams } from "next/navigation";
import { DebtDetail } from "@/components/DebtDetail";

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <DebtDetail id={id} />;
}
