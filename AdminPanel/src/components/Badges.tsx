import type { AttendanceEvent } from "@/lib/db/types";

export function DirectionBadge({ direction }: { direction: AttendanceEvent["direction"] }) {
  return direction === "IN" ? (
    <span className="badge bg-emerald-50 text-emerald-700">Giriş</span>
  ) : (
    <span className="badge bg-sky-50 text-sky-700">Çıkış</span>
  );
}

export function ReviewBadge({ status }: { status: AttendanceEvent["reviewStatus"] }) {
  if (status === "OK") return <span className="badge bg-emerald-50 text-emerald-700">Uygun</span>;
  if (status === "SUSPICIOUS") return <span className="badge bg-red-100 text-red-800">Şüpheli</span>;
  return <span className="badge bg-slate-100 text-slate-500">İncelenmedi</span>;
}

export function SourceBadge({ source }: { source: AttendanceEvent["source"] }) {
  if (source === "APP") return null;
  return <span className="badge bg-violet-50 text-violet-700">{source === "MANUAL" ? "Manuel" : "Çevrimdışı"}</span>;
}
