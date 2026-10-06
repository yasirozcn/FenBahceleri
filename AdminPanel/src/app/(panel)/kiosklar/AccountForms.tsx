"use client";

import { useActionState, useEffect, useRef } from "react";
import { createKioskAccountAction, resetKioskAccountPasswordAction } from "../actions";

export function AddKioskAccountForm() {
  const [state, action, pending] = useActionState(createKioskAccountAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block min-w-52 flex-1">
      <span className="mb-1.5 block text-sm font-bold text-slate-900">{label}</span>
      <input name={name} required className="input" {...props} />
    </label>
  );
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-3">
      {field("fullName", "Ad", { placeholder: "Ana kapı tableti" })}
      {field("email", "E-posta", { type: "email", autoComplete: "off", placeholder: "kapi@okulunuz.com" })}
      {field("password", "Şifre (en az 10 karakter)", { type: "password", minLength: 10, autoComplete: "new-password" })}
      <button className="btn btn-primary h-11 rounded-xl px-5" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Hesap oluştur"}
      </button>
      {state.error && <p role="alert" className="w-full rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{state.error}</p>}
      {state.ok && <p className="w-full rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Hesap oluşturuldu. Tablette &quot;Yönetici girişi&quot; ile bu e-posta ve şifreyle girilebilir.</p>}
    </form>
  );
}

export function ResetKioskPasswordForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState(resetKioskAccountPasswordAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input name="password" type="password" required minLength={10} autoComplete="new-password" placeholder="Yeni şifre (en az 10)" className="input h-10 w-52" />
      <button className="btn btn-secondary" disabled={pending}>{pending ? "Kaydediliyor…" : "Şifreyi sıfırla"}</button>
      {state.error && <span role="alert" className="text-sm font-semibold text-red-700">{state.error}</span>}
      {state.ok && <span className="text-sm font-semibold text-emerald-700">Şifre güncellendi.</span>}
    </form>
  );
}
