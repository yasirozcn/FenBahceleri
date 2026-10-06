import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DirectionBadge, ReviewBadge, SourceBadge } from "@/components/Badges";
import { dashboardStats, listEvents } from "@/lib/db/repo";
import { formatDateTime } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, events] = await Promise.all([dashboardStats(), listEvents({ limit: 15 })]);

  const tiles = [
    { label: "Okulda", value: stats.inside, sub: `${stats.total} öğrenciden`, tone: "text-brand-600" },
    { label: "Dışarıda", value: stats.outside, sub: "şu an", tone: "text-slate-900" },
    { label: "Bugünkü hareket", value: stats.todayEvents, sub: `${stats.unreviewed} incelenmedi`, tone: "text-slate-900" },
    { label: "Reddedilen okutma", value: stats.rejectedToday, sub: "bugün", tone: stats.rejectedToday ? "text-red-800" : "text-slate-900" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="page-title">Canlı durum</h1>
          <p className="page-sub">Okuldaki öğrenciler ve son giriş-çıkışlar.</p>
        </div>
        <AutoRefresh seconds={10} />
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {tiles.map((t, i) => {
          const alert = i === 3 && stats.rejectedToday > 0;
          return (
            <div key={t.label} className={`flex flex-col gap-2 rounded-2xl border p-[18px] ${alert ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
              <div className={`text-sm font-bold ${alert ? "text-red-800" : "text-slate-500"}`}>{t.label}</div>
              <div className={`text-[40px] leading-none font-bold tabular-nums ${t.tone}`}>{t.value}</div>
              <div className={`text-sm ${alert ? "text-red-800" : "text-slate-500"}`}>{t.sub}</div>
              {i === 0 && stats.total > 0 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-1.5 bg-brand-600" style={{ width: `${Math.round((stats.inside / stats.total) * 100)}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="card overflow-hidden rounded-[18px]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold">Son hareketler</h2>
          <Link href="/hareketler" className="text-sm font-bold text-brand-700 hover:text-brand-800">
            Tümünü gör →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th>Hareket</th>
                <th>Zaman</th>
                <th>Kiosk</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Henüz giriş-çıkış yok. Mobil uygulamada yönetici girişiyle kiosk ekranını açıp bir öğrenci hesabıyla QR okutun.
                  </td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="font-bold whitespace-nowrap">
                      {e.student.firstName} {e.student.lastName}
                    </div>
                    <div className="text-[13px] whitespace-nowrap text-slate-500">
                      {e.student.className} · No {e.student.schoolNo}
                    </div>
                  </td>
                  <td>
                    <DirectionBadge direction={e.direction} /> <SourceBadge source={e.source} />
                  </td>
                  <td className="font-mono text-sm tabular-nums">{formatDateTime(e.occurredAt)}</td>
                  <td className="text-slate-500">{e.kioskName ?? "-"}</td>
                  <td>
                    <ReviewBadge status={e.reviewStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
