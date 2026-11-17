"use client";

import clsx from "clsx";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileUp,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { type SyncStatus, useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, section: "Bureau" },
  { href: "/parc", label: "Parc de modules", icon: Package, section: "Bureau" },
  { href: "/contrats", label: "Contrats", icon: ClipboardList, section: "Bureau" },
  { href: "/planning", label: "Planning", icon: CalendarDays, section: "Bureau" },
  { href: "/demandes", label: "Demandes clients", icon: Bell, section: "Bureau" },
  { href: "/import", label: "Import du parc", icon: FileUp, section: "Bureau" },
  { href: "/atelier", label: "Atelier", icon: Wrench, section: "Atelier" },
  { href: "/parametres", label: "Paramètres", icon: Settings, section: "Réglages" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data, syncStatus, syncError } = useStore();
  const nouvelles = data.demandes.filter((d) => !d.traitee).length;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const sections = Array.from(new Set(NAV.map((n) => n.section)));

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      {sections.map((section) => (
        <div key={section}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section}</p>
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.section === section).map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/demandes" && nouvelles > 0 && (
                      <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">{nouvelles}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2.5 px-6 py-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">L</span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-slate-900">Loc and Go</span>
        <span className="block max-w-[150px] truncate text-xs text-slate-500">{data.parametres.nomLoueur}</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barre latérale ordinateur */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        {brand}
        {nav}
        <SyncBadge status={syncStatus} error={syncError} />
      </aside>

      {/* Barre du haut mobile */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        {brand}
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            <SyncBadge status={syncStatus} error={syncError} />
          </div>
        </div>
      )}

      <main className="lg:pl-64 print:pl-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {syncStatus === "error" && (
            <div className="no-print mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
              La base de données en ligne ne répond pas : les dernières modifications ne sont peut-être pas enregistrées. Vérifiez la connexion et la configuration Supabase.
              {syncError && <span className="mt-1 block text-xs text-rose-600">{syncError}</span>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function SyncBadge({ status, error }: { status: SyncStatus; error: string }) {
  const label = {
    local: "Données dans ce navigateur",
    ok: "Données en ligne à jour",
    saving: "Enregistrement…",
    error: "Erreur de synchronisation",
  }[status];
  const dot = { local: "bg-slate-400", ok: "bg-emerald-500", saving: "bg-amber-400", error: "bg-rose-500" }[status];
  return (
    <p className="flex items-center gap-2 px-6 pb-5 text-[11px] leading-relaxed text-slate-500" title={error || undefined}>
      <span className={clsx("h-2 w-2 flex-none rounded-full", dot)} />
      {label}
    </p>
  );
}
