import { listStudents } from "@/lib/db/repo";
import { formatDateTime } from "@/lib/sms";
import { manualEventAction, resetDeviceAction, resetPasswordAction } from "../actions";
import { AddStudentForm } from "./StudentForms";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const students = await listStudents();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Öğrenciler</h1>
        <p className="page-sub">
          Öğrenciler uygulamada kayıt olamaz; yalnızca burada tanımlanan e-postalar giriş yapabilir. Öğrenci ilk girişte şifresini oluşturur ve hesabı o telefona bağlanır. Şifresini unutan öğrenci için <b>Şifreyi sıfırla</b>, telefon değiştiren öğrenci için <b>Cihazı sıfırla</b>.
        </p>
      </div>

      <div className="card overflow-x-auto rounded-[18px]">
        <table className="table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>E-posta</th>
              <th>Veli</th>
              <th>Durum</th>
              <th>Cihaz</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-bold whitespace-nowrap">
                    {s.firstName} {s.lastName}
                  </div>
                  <div className="text-[13px] whitespace-nowrap text-slate-500">
                    {s.className} · No {s.schoolNo}
                  </div>
                </td>
                <td className="text-slate-600">{s.email}</td>
                <td className="text-xs text-slate-600">
                  {s.guardians.map((g) => (
                    <div key={g.id}>
                      {g.fullName} · {g.phone}
                    </div>
                  ))}
                </td>
                <td>
                  {s.presenceStatus === "IN" ? <span className="badge bg-emerald-50 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />Okulda</span> : <span className="badge bg-slate-100 text-slate-500"><span className="h-2 w-2 rounded-full border-2 border-slate-400" />Dışarıda</span>}
                </td>
                <td className="text-xs">
                  {s.activeDevice ? (
                    <div>
                      <div className="font-medium text-slate-700">{s.activeDevice.platform === "ios" ? "iPhone" : s.activeDevice.platform === "android" ? "Android" : s.activeDevice.platform}</div>
                      <div className="text-slate-400">{formatDateTime(s.activeDevice.boundAt)}</div>
                    </div>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-500">Henüz giriş yapmadı</span>
                  )}
                  {s.activeDevice && !s.passwordHash && <div className="mt-1"><span className="badge bg-amber-50 text-amber-700">Yeni şifre bekleniyor</span></div>}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {s.passwordHash && (
                      <form action={resetPasswordAction}>
                        <input type="hidden" name="studentId" value={s.id} />
                        <button className="btn btn-secondary" title="Şifreyi siler; telefon bağlı kalır. Öğrenci aynı telefonda yeni şifre oluşturur.">
                          Şifreyi sıfırla
                        </button>
                      </form>
                    )}
                    {s.activeDevice && (
                      <form action={resetDeviceAction}>
                        <input type="hidden" name="studentId" value={s.id} />
                        <button className="btn btn-danger" title="Telefon bağlantısını ve şifreyi siler; öğrenci yeni telefonunda şifre oluşturarak giriş yapar.">
                          Cihazı sıfırla
                        </button>
                      </form>
                    )}
                    <form action={manualEventAction} className="flex gap-1">
                      <input type="hidden" name="studentId" value={s.id} />
                      <input type="hidden" name="direction" value={s.presenceStatus === "IN" ? "OUT" : "IN"} />
                      <input type="hidden" name="note" value="Panelden manuel kayıt" />
                      <button className="btn btn-secondary" title="Telefonunu unutan öğrenci için">
                        Manuel {s.presenceStatus === "IN" ? "çıkış" : "giriş"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card p-5 md:p-6">
        <h2 className="mb-4 text-lg font-bold">Yeni öğrenci ekle</h2>
        <AddStudentForm />
      </section>
    </div>
  );
}
