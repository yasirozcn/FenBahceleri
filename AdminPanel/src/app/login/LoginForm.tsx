"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-bold">E-posta</span>
        <input name="email" type="email" required autoComplete="username" className="input h-[50px]" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-bold">Şifre</span>
        <input name="password" type="password" required autoComplete="current-password" className="input h-[50px]" />
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary h-[52px] w-full rounded-xl text-base">
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
