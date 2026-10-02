import { redirect } from "next/navigation";
import { getWebAdmin } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getWebAdmin()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">Fen Bahçeleri</div>
          <h1 className="mt-1 text-xl font-semibold">Giriş-Çıkış Yönetim Paneli</h1>
          <p className="mt-1 text-sm text-slate-500">Yönetici hesabınızla giriş yapın.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
