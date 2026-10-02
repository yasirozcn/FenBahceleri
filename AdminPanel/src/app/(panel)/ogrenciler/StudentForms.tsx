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
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} className="input" {...props} />
    </label>
  );
  return (
    <form ref={ref} action={action} className="grid gap-3 md:grid-cols-4">
      {field("schoolNo", "Okul no *", { required: true })}
      {field("firstName", "Ad *", { required: true })}
      {field("lastName", "Soyad *", { required: true })}
      {field("className", "Sınıf *", { required: true, placeholder: "9-A" })}
      {field("email", "E-posta *", { required: true, type: "email" })}
      {field("guardianName", "Veli adı")}
      {field("guardianPhone", "Veli telefonu", { placeholder: "+90555..." })}
      <div className="flex items-end">
        <button className="btn btn-primary w-full py-2" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Öğrenci ekle"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-700 md:col-span-4">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700 md:col-span-4">Öğrenci eklendi. Öğrenci uygulamada bu e-postayla giriş yapıp şifresini oluşturabilir.</p>}
    </form>
  );
}
