import { listKiosks } from "@/lib/db/repo";
import { formatDateTime } from "@/lib/sms";
import { createKioskAction, toggleKioskAction } from "../actions";

export const dynamic = "force-dynamic";

function isOnline(lastSeenAt: string | null): boolean {
  return !!lastSeenAt && Date.now() - Date.parse(lastSeenAt) < 60_000;
}

export default async function KiosksPage() {
  const kiosks = await listKiosks();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kiosklar</h1>
        <p className="text-sm text-slate-500">
          Her kiosk tek yöne sabitlenir. Tablette uygulamayı açıp &quot;Yönetici girişi&quot; ile oturum açın ve bu listeden kioskunu seçin; ekranda dönen QR görünür.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Yön</th>
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
                  <td className="font-medium">{k.name}</td>
                  <td>{k.direction === "ENTRY" ? "Giriş" : "Çıkış"}</td>
                  <td>
                    {k.status === "ACTIVE" ? <span className="badge bg-emerald-50 text-emerald-700">Aktif</span> : <span className="badge bg-slate-100 text-slate-500">Devre dışı</span>}
                  </td>
                  <td className="text-xs">
                    {k.lastSeenAt ? (
                      <span className={online ? "text-emerald-700" : "text-slate-500"}>
                        {online ? "Çevrimiçi · " : ""}
                        {formatDateTime(k.lastSeenAt)}
                      </span>
                    ) : (
                      <span className="text-slate-400">Hiç bağlanmadı</span>
                    )}
                  </td>
                  <td>
                    <form action={toggleKioskAction}>
                      <input type="hidden" name="kioskId" value={k.id} />
                      <input type="hidden" name="status" value={k.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} />
                      <button className={`btn ${k.status === "ACTIVE" ? "btn-danger" : "btn-secondary"}`}>{k.status === "ACTIVE" ? "Devre dışı bırak" : "Etkinleştir"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Yeni kiosk</h2>
        <form action={createKioskAction} className="flex flex-wrap items-end gap-3">
          <label className="block min-w-60 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Ad</span>
            <input name="name" required className="input" placeholder="Arka kapı giriş" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Yön</span>
            <select name="direction" className="input">
              <option value="ENTRY">Giriş</option>
              <option value="EXIT">Çıkış</option>
            </select>
          </label>
          <button className="btn btn-primary py-2">Ekle</button>
        </form>
      </section>
    </div>
  );
}
