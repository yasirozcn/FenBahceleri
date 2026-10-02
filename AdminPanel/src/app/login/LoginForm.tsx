"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">E-posta</span>
        <input name="email" type="email" required autoComplete="username" className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Şifre</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full py-2">
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
