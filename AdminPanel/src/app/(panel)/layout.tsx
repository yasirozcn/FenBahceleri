import Link from "next/link";
import { requireWebAdmin } from "@/lib/session";
import { logoutAction } from "../login/actions";
import { NavLinks } from "./NavLinks";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireWebAdmin();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Link href="/" className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">Fen Bahçeleri</div>
            <div className="text-base font-semibold">Giriş-Çıkış Paneli</div>
          </Link>
        </div>
        <NavLinks />
        <div className="hidden border-t border-slate-100 px-4 py-4 text-sm md:block">
          <div className="font-medium">{admin.fullName}</div>
          <div className="truncate text-xs text-slate-500">{admin.email}</div>
          <form action={logoutAction} className="mt-3">
            <button className="btn btn-secondary w-full">Çıkış yap</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
