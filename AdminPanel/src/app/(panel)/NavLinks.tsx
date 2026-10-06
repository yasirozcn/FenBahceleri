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

// Menü ikonları (yalnızca görünüm; 24×24 çizgi ikon yolları)
const icons: Record<string, string> = {
  "/": "M3 12h4l3-8 4 16 3-8h4",
  "/hareketler": "M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3",
  "/ogrenciler": "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7M22 21v-1a6 6 0 00-4-5.6",
  "/kiosklar": "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2",
  "/denemeler": "M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8",
  "/sms": "M4 5h16v11H8l-4 4z",
  "/denetim": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
};

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Panel menüsü" className="flex gap-0.5 overflow-x-auto px-2 pb-2 md:flex-col md:px-4 md:pb-4">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-[42px] items-center gap-3 rounded-[10px] px-3 text-[15px] whitespace-nowrap ${active ? "bg-brand-50 font-bold text-brand-800" : "font-semibold text-slate-900 hover:bg-slate-100"}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 shrink-0 ${active ? "text-brand-600" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <path d={icons[l.href]} />
            </svg>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
