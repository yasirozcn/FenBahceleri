import Link from "next/link";
import { requireWebAdmin } from "@/lib/session";
import { logoutAction } from "../login/actions";
import { NavLinks } from "./NavLinks";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireWebAdmin();
  const initials = admin.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 md:px-6 md:pt-6 md:pb-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-brand-600 text-[15px] font-extrabold text-white">FB</span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold">Fen Bahçeleri</span>
              <span className="text-xs text-slate-500">Giriş-Çıkış Paneli</span>
            </span>
          </Link>
        </div>
        <NavLinks />
        <div className="hidden flex-1 md:block" />
        <div className="hidden border-t border-slate-100 px-6 py-4 text-sm md:block">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold">{initials}</span>
            <div className="min-w-0">
              <div className="truncate font-bold">{admin.fullName}</div>
              <div className="truncate text-xs text-slate-500">{admin.email}</div>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button className="btn btn-secondary w-full">Çıkış yap</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-9 md:pt-7 md:pb-12">{children}</main>
    </div>
  );
}
