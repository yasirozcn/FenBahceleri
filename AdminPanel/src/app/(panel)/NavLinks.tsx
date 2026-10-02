"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Canlı durum" },
  { href: "/hareketler", label: "Giriş-çıkışlar" },
  { href: "/ogrenciler", label: "Öğrenciler" },
  { href: "/kiosklar", label: "Kiosklar" },
  { href: "/denemeler", label: "Reddedilen okutmalar" },
  { href: "/sms", label: "SMS kayıtları" },
  { href: "/denetim", label: "Denetim kaydı" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-4">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${active ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
