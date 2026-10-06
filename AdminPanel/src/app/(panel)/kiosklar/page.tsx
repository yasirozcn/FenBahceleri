import { listKiosks } from "@/lib/db/repo";
import { formatDateTime } from "@/lib/sms";
import { createKioskAction, deleteKioskAction, toggleKioskAction } from "../actions";
import DeleteKioskButton from "./DeleteKioskButton";

export const dynamic = "force-dynamic";

function isOnline(lastSeenAt: string | null): boolean {
  return !!lastSeenAt && Date.now() - Date.parse(lastSeenAt) < 60_000;
}

export default async function KiosksPage() {
  const kiosks = await listKiosks();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Kiosklar</h1>
        <p className="page-sub">
          Kiosk yönsüzdür: aynı QR hem giriş hem çıkış için okutulur. Öğrenci ilk okutmada yönü seçer; sonrasında sistem okuldaysa çıkış, dışarıdaysa giriş kaydeder. Tablette uygulamayı açıp &quot;Yönetici girişi&quot; ile oturum açın ve kioskunu seçin.
        </p>
      </div>
      <div className="card overflow-x-auto rounded-[18px]">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Durum</th>
              <th>Son sinyal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {kiosks.map((k) => {
              const online = isOnline(k.lastSeenAt);
              return (
                <tr key={k.id}>
                  <td className="font-bold">{k.name}</td>
                  <td>
                    {k.status === "ACTIVE" ? <span className="badge bg-emerald-50 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />Aktif</span> : <span className="badge bg-slate-100 text-slate-500"><span className="h-2 w-2 rounded-full border-2 border-slate-400" />Devre dışı</span>}
                  </td>
                  <td className="text-sm">
                    {k.lastSeenAt ? (
                      <span className={`inline-flex items-center gap-2 ${online ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
                        <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-600" : "bg-slate-300"}`} />
                        {online ? "Çevrimiçi · " : ""}
                        {formatDateTime(k.lastSeenAt)}
                      </span>
                    ) : (
                      <span className="text-slate-400">Hiç bağlanmadı</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleKioskAction}>
                        <input type="hidden" name="kioskId" value={k.id} />
                        <input type="hidden" name="status" value={k.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} />
                        <button className={`btn ${k.status === "ACTIVE" ? "btn-danger" : "btn-secondary"}`}>{k.status === "ACTIVE" ? "Devre dışı bırak" : "Etkinleştir"}</button>
                      </form>
                      <form action={deleteKioskAction}>
                        <input type="hidden" name="kioskId" value={k.id} />
                        <DeleteKioskButton name={k.name} />
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="card p-5 md:p-6">
        <h2 className="mb-4 text-lg font-bold">Yeni kiosk</h2>
        <form action={createKioskAction} className="flex flex-wrap items-end gap-3">
          <label className="block min-w-60 flex-1">
            <span className="mb-1.5 block text-sm font-bold text-slate-900">Ad</span>
            <input name="name" required className="input" placeholder="Ana kapı" />
          </label>
          <button className="btn btn-primary h-11 rounded-xl px-5">Ekle</button>
        </form>
      </section>
    </div>
  );
}
