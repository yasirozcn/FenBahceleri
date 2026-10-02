import { listScanAttempts } from "@/lib/db/repo";
import { REJECT_MESSAGES } from "@/lib/scan";
import { formatDateTime } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default async function AttemptsPage() {
  const rows = await listScanAttempts(true, 300);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reddedilen okutmalar</h1>
        <p className="text-sm text-slate-500">Süresi geçmiş QR, yanlış cihaz, BLE doğrulanamaması gibi nedenlerle reddedilen tüm denemeler. Hile girişimleri burada iz bırakır.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Öğrenci</th>
              <th>Kiosk</th>
              <th>Neden</th>
              <th>BLE</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Reddedilen okutma yok.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="tabular-nums">{formatDateTime(r.createdAt)}</td>
                <td>{r.studentName ?? "-"}</td>
                <td className="text-slate-500">{r.kioskName ?? "-"}</td>
                <td>
                  <span className="font-mono text-xs text-red-700">{r.rejectReason}</span>
                  <div className="text-xs text-slate-500">{r.rejectReason ? REJECT_MESSAGES[r.rejectReason] : ""}</div>
                </td>
                <td className="text-xs text-slate-500">{r.bleToken ? `${r.bleOk ? "doğru" : "hatalı"}${r.bleRssi != null ? ` · ${r.bleRssi} dBm` : ""}` : "yok"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
