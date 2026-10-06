"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sayfayı belirli aralıklarla sunucudan yeniler (1. aşama; ileride WebSocket ile anlık). */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <span className="h-2 w-2 rounded-full bg-brand-600 ring-4 ring-brand-50" />
      {seconds} sn&apos;de bir yenilenir
    </span>
  );
}
