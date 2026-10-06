import { listSms } from "@/lib/db/repo";
import { config } from "@/lib/config";
import { formatDateTime } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const rows = await listSms(300);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">SMS kayıtları</h1>
        <p className="page-sub">
          {config.smsProvider === "mock"
            ? "Test modu: SMS'ler gerçekten gönderilmez, yalnızca burada ve sunucu konsolunda görünür."
            : `Sağlayıcı: ${config.smsProvider}`}
        </p>
      </div>
      <div className="card overflow-x-auto rounded-[18px]">
        <table className="table">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Öğrenci</th>
              <th>Telefon</th>
              <th>Mesaj</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400">
                  Henüz SMS yok.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="font-mono text-sm whitespace-nowrap tabular-nums">{formatDateTime(m.createdAt)}</td>
                <td className="font-bold">{m.studentName}</td>
                <td className="font-mono text-xs">{m.phone}</td>
                <td className="max-w-md text-[13px] leading-snug text-slate-600">{m.body}</td>
                <td>
                  <span className={`badge ${m.status === "FAILED" ? "bg-red-50 text-red-700" : m.status === "QUEUED" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
