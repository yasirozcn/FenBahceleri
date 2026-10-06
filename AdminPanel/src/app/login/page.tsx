import { redirect } from "next/navigation";
import { getWebAdmin } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getWebAdmin()) redirect("/");
  return (
    <main className="flex min-h-screen flex-wrap">
      <section className="hidden flex-[1_1_480px] flex-col gap-8 bg-[#14211A] p-14 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-[17px] font-extrabold">FB</span>
          <span className="flex flex-col">
            <span className="font-bold">Fen Bahçeleri</span>
            <span className="text-sm text-[#A9C9B4]">Giriş-Çıkış Yönetim Paneli</span>
          </span>
        </div>
        <h2 className="max-w-[520px] text-5xl leading-[1.04] font-bold tracking-[-0.02em]">Kim okulda, kim çıktı — tek bakışta.</h2>
        <div className="flex-1" />
      </section>
      <div className="flex flex-[1_1_520px] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-7">
            <div className="text-xs font-bold tracking-[0.12em] text-brand-700 uppercase lg:hidden">Fen Bahçeleri</div>
            <h1 className="mt-1 text-[32px] font-bold tracking-[-0.01em]">Giriş-Çıkış Yönetim Paneli</h1>
            <p className="mt-2 text-base text-slate-500">Yönetici hesabınızla giriş yapın.</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
