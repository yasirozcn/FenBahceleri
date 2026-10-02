import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DirectionBadge, ReviewBadge, SourceBadge } from "@/components/Badges";
import { dashboardStats, listEvents } from "@/lib/db/repo";
import { formatDateTime } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, events] = await Promise.all([dashboardStats(), listEvents({ limit: 15 })]);

  const tiles = [
    { label: "Okulda", value: stats.inside, sub: `${stats.total} öğrenciden`, tone: "text-emerald-700" },
    { label: "Dışarıda", value: stats.outside, sub: "şu an", tone: "text-slate-900" },
    { label: "Bugünkü hareket", value: stats.todayEvents, sub: `${stats.unreviewed} incelenmedi`, tone: "text-slate-900" },
    { label: "Reddedilen okutma", value: stats.rejectedToday, sub: "bugün", tone: stats.rejectedToday ? "text-amber-700" : "text-slate-900" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Canlı durum</h1>
          <p className="text-sm text-slate-500">Okuldaki öğrenciler ve son giriş-çıkışlar.</p>
        </div>
        <AutoRefresh seconds={10} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <div className="text-xs font-medium text-slate-500">{t.label}</div>
            <div className={`mt-1 text-3xl font-semibold tabular-nums ${t.tone}`}>{t.value}</div>
            <div className="text-xs text-slate-400">{t.sub}</div>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Son hareketler</h2>
          <Link href="/hareketler" className="text-sm font-medium text-brand-700 hover:underline">
            Tümünü gör
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
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Henüz giriş-çıkış yok. Mobil uygulamada yönetici girişiyle kiosk ekranını açıp bir öğrenci hesabıyla QR okutun.
                  </td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="font-medium">
                      {e.student.firstName} {e.student.lastName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {e.student.className} · No {e.student.schoolNo}
                    </div>
                  </td>
                  <td>
                    <DirectionBadge direction={e.direction} /> <SourceBadge source={e.source} />
                  </td>
                  <td className="tabular-nums">{formatDateTime(e.occurredAt)}</td>
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
