import Link from "next/link";
import { DirectionBadge, ReviewBadge, SourceBadge } from "@/components/Badges";
import { listEvents } from "@/lib/db/repo";
import { formatDateTime } from "@/lib/sms";
import { reviewEventAction } from "../actions";

export const dynamic = "force-dynamic";

const filters = [
  { key: "", label: "Tümü" },
  { key: "unreviewed", label: "İncelenmedi" },
  { key: "flagged", label: "Dikkat gerekenler" },
  { key: "suspicious", label: "Şüpheli" },
];

export default async function EventsPage({ searchParams }: PageProps<"/hareketler">) {
  const sp = await searchParams;
  const f = typeof sp.f === "string" ? sp.f : "";
  const events = await listEvents({
    review: f === "unreviewed" ? "UNREVIEWED" : f === "suspicious" ? "SUSPICIOUS" : undefined,
    onlyFlagged: f === "flagged",
    limit: 300,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Giriş-çıkışlar</h1>
        <p className="text-sm text-slate-500">
          Tüm giriş-çıkış kayıtları. Şüphelendiğiniz kaydı işaretleyebilirsiniz. &quot;Dikkat gerekenler&quot; manuel ve şüpheli kayıtları gösterir.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((x) => (
          <Link key={x.key} href={x.key ? `/hareketler?f=${x.key}` : "/hareketler"} className={`btn ${f === x.key ? "btn-primary" : "btn-secondary"}`}>
            {x.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Hareket</th>
              <th>Zaman</th>
              <th>İnceleme</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Kayıt yok.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className={e.reviewStatus === "SUSPICIOUS" ? "bg-red-50/50" : undefined}>
                <td>
                  <div className="font-medium">
                    {e.student.firstName} {e.student.lastName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {e.student.className} · No {e.student.schoolNo}
                  </div>
                  {e.note && <div className="mt-1 text-xs text-violet-700">Not: {e.note}</div>}
                </td>
                <td>
                  <DirectionBadge direction={e.direction} /> <SourceBadge source={e.source} />
                  <div className="mt-1 text-xs text-slate-500">{e.kioskName ?? ""}</div>
                </td>
                <td className="tabular-nums">{formatDateTime(e.occurredAt)}</td>
                <td>
                  <ReviewBadge status={e.reviewStatus} />
                </td>
                <td>
                  <div className="flex gap-2">
                    <form action={reviewEventAction}>
                      <input type="hidden" name="eventId" value={e.id} />
                      <input type="hidden" name="status" value="OK" />
                      <button className="btn btn-secondary">Uygun</button>
                    </form>
                    <form action={reviewEventAction}>
                      <input type="hidden" name="eventId" value={e.id} />
                      <input type="hidden" name="status" value="SUSPICIOUS" />
                      <button className="btn btn-danger">Şüpheli</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
