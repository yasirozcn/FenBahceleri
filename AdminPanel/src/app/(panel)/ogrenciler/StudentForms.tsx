"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStudentAction } from "../actions";

export function AddStudentForm() {
  const [state, action, pending] = useActionState(createStudentAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-900">{label}</span>
      <input name={name} className="input" {...props} />
    </label>
  );
  return (
    <form ref={ref} action={action} className="grid gap-4 md:grid-cols-4">
      {field("schoolNo", "Okul no *", { required: true })}
      {field("firstName", "Ad *", { required: true })}
      {field("lastName", "Soyad *", { required: true })}
      {field("className", "Sınıf *", { required: true, placeholder: "9-A" })}
      {field("email", "E-posta *", { required: true, type: "email" })}
      {field("guardianName", "Veli adı")}
      {field("guardianPhone", "Veli telefonu", { placeholder: "+90555..." })}
      <div className="flex items-end">
        <button className="btn btn-primary h-11 w-full rounded-xl" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Öğrenci ekle"}
        </button>
      </div>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 md:col-span-4">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 md:col-span-4">Öğrenci eklendi. Öğrenci uygulamada bu e-postayla giriş yapıp şifresini oluşturabilir.</p>}
    </form>
  );
}
