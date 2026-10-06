import { listAudit } from "@/lib/db/repo";
import { formatDateTime } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const rows = await listAudit(300);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Denetim kaydı</h1>
        <p className="page-sub">Panelde ve kiosklarda yapılan yönetici işlemleri. Bu kayıtlar silinmez.</p>
      </div>
      <div className="card overflow-x-auto rounded-[18px]">
        <table className="table">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Kim</th>
              <th>İşlem</th>
              <th>Kayıt</th>
              <th>Ayrıntı</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-sm whitespace-nowrap tabular-nums">{formatDateTime(a.createdAt)}</td>
                <td>{a.adminName ?? "Öğrenci uygulaması"}</td>
                <td className="font-mono text-xs">{a.action}</td>
                <td className="text-xs text-slate-500">
                  {a.entity} {a.entityId ? `· ${a.entityId}` : ""}
                </td>
                <td className="max-w-sm truncate font-mono text-xs text-slate-500">{a.afterValue ? JSON.stringify(a.afterValue) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
