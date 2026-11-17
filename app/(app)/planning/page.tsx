"use client";

import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight, Download, List } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { buildEvents, type CalendarEvent, type EventKind, KIND_CLASSES, KIND_LABEL, toIcs } from "@/lib/calendar";
import { useStore } from "@/lib/store";
import { addDays, formatDate, today } from "@/lib/utils";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const KINDS: EventKind[] = ["livraison", "retour", "fin", "sav"];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function PlanningPage() {
  const { data } = useStore();
  const day = today();
  const [vue, setVue] = useState<"mois" | "liste">("mois");
  const [mois, setMois] = useState(() => ({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1 }));
  const [selection, setSelection] = useState(day);
  const [actifs, setActifs] = useState<EventKind[]>(KINDS);

  const tous = useMemo(() => buildEvents(data), [data]);
  const events = tous.filter((e) => actifs.includes(e.kind));
  const parJour = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);

  // Grille du mois, semaines commençant le lundi.
  const cases = useMemo(() => {
    const first = new Date(mois.y, mois.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = iso(mois.y, mois.m, 1);
    const debut = addDays(start, -offset);
    const nbJours = new Date(mois.y, mois.m + 1, 0).getDate();
    const semaines = Math.ceil((offset + nbJours) / 7);
    return Array.from({ length: semaines * 7 }, (_, i) => addDays(debut, i));
  }, [mois]);

  const titreMois = new Date(mois.y, mois.m, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const changerMois = (delta: number) => {
    const d = new Date(mois.y, mois.m + delta, 1);
    setMois({ y: d.getFullYear(), m: d.getMonth() });
  };
  const aujourdhui = () => {
    setMois({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1 });
    setSelection(day);
  };

  const exporter = () => {
    const ics = toIcs(events, data.parametres.nomLoueur, window.location.origin);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning-loc-and-go-${day}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const enRetard = events.filter((e) => !e.done && e.date < day && e.kind !== "sav");
  const aVenir = events.filter((e) => e.date >= day);
  const groupesAVenir = Array.from(
    aVenir.reduce((map, e) => map.set(e.date, [...(map.get(e.date) ?? []), e]), new Map<string, CalendarEvent[]>()),
  );

  return (
    <>
      <PageHeader
        title="Planning"
        description="Livraisons, retours, fins de contrat et SAV, jour par jour."
        actions={
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exporter} disabled={events.length === 0}>
            Exporter vers Google Agenda / Outlook
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const on = actifs.includes(k);
            const n = tous.filter((e) => e.kind === k && e.date >= day).length;
            return (
              <button
                key={k}
                onClick={() => setActifs(on ? actifs.filter((x) => x !== k) : [...actifs, k])}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
                  on ? "bg-white text-slate-800 ring-slate-300" : "bg-slate-100 text-slate-400 ring-slate-200",
                )}
                aria-pressed={on}
              >
                <span className={clsx("h-2 w-2 rounded-full", on ? KIND_CLASSES[k].dot : "bg-slate-300")} />
                {KIND_LABEL[k]} ({n} à venir)
              </button>
            );
          })}
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {(
            [
              ["mois", "Mois", CalendarDays],
              ["liste", "Liste", List],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setVue(key)}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                vue === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {enRetard.length > 0 && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
          <strong>{enRetard.length} échéance(s) dépassée(s)</strong> :{" "}
          {enRetard.slice(0, 4).map((e, i) => (
            <span key={e.id}>
              {i > 0 && " · "}
              <Link href={e.href} className="underline">
                {e.title}
              </Link>{" "}
              ({formatDate(e.date)})
            </span>
          ))}
          {enRetard.length > 4 && " …"}
        </div>
      )}

      {vue === "mois" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-semibold capitalize text-slate-900">{titreMois}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => changerMois(-1)} aria-label="Mois précédent">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="sm" onClick={aujourdhui}>
                  Aujourd&apos;hui
                </Button>
                <Button variant="ghost" size="sm" onClick={() => changerMois(1)} aria-label="Mois suivant">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </header>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-medium text-slate-500">
              {JOURS.map((j) => (
                <div key={j} className="py-2">
                  {j}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cases.map((d) => {
                const dansMois = Number(d.slice(5, 7)) - 1 === mois.m;
                const evs = parJour.get(d) ?? [];
                const choisi = d === selection;
                return (
                  <button
                    key={d}
                    onClick={() => setSelection(d)}
                    className={clsx(
                      "flex min-h-[64px] flex-col items-stretch gap-1 border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[104px]",
                      dansMois ? "bg-white" : "bg-slate-50/70",
                      choisi ? "ring-2 ring-inset ring-brand-500" : "hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        d === day ? "bg-brand-600 font-semibold text-white" : dansMois ? "text-slate-700" : "text-slate-400",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {/* Téléphone : des points ; ordinateur : les intitulés. */}
                    <span className="flex flex-wrap gap-1 sm:hidden">
                      {evs.slice(0, 4).map((e) => (
                        <span key={e.id} className={clsx("h-1.5 w-1.5 rounded-full", e.done ? "bg-slate-300" : KIND_CLASSES[e.kind].dot)} />
                      ))}
                    </span>
                    <span className="hidden flex-col gap-1 sm:flex">
                      {evs.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={clsx(
                            "truncate rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                            e.done ? "bg-slate-50 text-slate-400 ring-slate-200 line-through" : KIND_CLASSES[e.kind].chip,
                          )}
                        >
                          {e.title}
                        </span>
                      ))}
                      {evs.length > 3 && <span className="px-1 text-[11px] text-slate-500">+ {evs.length - 3} autre(s)</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <Card title={<span className="capitalize">{new Date(`${selection}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>}>
            <EventList events={parJour.get(selection) ?? []} empty="Rien de prévu ce jour-là." />
          </Card>
        </div>
      ) : groupesAVenir.length === 0 ? (
        <EmptyState title="Rien de prévu à partir d'aujourd'hui" description="Les livraisons, retours et fins de contrat apparaîtront ici dès qu'ils seront enregistrés." />
      ) : (
        <div className="space-y-4">
          {groupesAVenir.map(([date, evs]) => (
            <Card
              key={date}
              title={
                <span className="capitalize">
                  {date === day ? "Aujourd'hui · " : date === addDays(day, 1) ? "Demain · " : ""}
                  {new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              }
            >
              <EventList events={evs} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function EventList({ events, empty }: { events: CalendarEvent[]; empty?: string }) {
  if (events.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={e.href} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
            <span className={clsx("mt-1.5 h-2.5 w-2.5 flex-none rounded-full", e.done ? "bg-slate-300" : KIND_CLASSES[e.kind].dot)} />
            <span className="min-w-0">
              <span className={clsx("block text-sm font-medium", e.done ? "text-slate-400 line-through" : "text-slate-900")}>{e.title}</span>
              {e.detail && <span className="block text-xs text-slate-500">{e.detail}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
