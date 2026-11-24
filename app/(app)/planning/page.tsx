"use client";

import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight, Download, ExternalLink, List, MessageSquare, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { buildEvents, type CalendarEvent, classesOf, COULEUR_CLASSES, COULEURS, couleurDe, type EventKind, KIND_CLASSES, KIND_LABEL, toIcs } from "@/lib/calendar";
import type { CalendarItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { addDays, formatDate, today } from "@/lib/utils";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const BASE_KINDS: EventKind[] = ["livraison", "retour", "fin", "sav"];
const KINDS: EventKind[] = [...BASE_KINDS, "perso"];

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
  const [ouvert, setOuvert] = useState<CalendarEvent | null>(null);
  const [nouveau, setNouveau] = useState<string | null>(null); // date du nouvel événement

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
    const ics = toIcs(events, data.parametres.nomLoueur, window.location.origin, data);
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
        description="Livraisons, retours, fins de contrat, SAV et vos propres événements, jour par jour. Cliquez sur un événement pour changer sa date ou le commenter."
        actions={
          <>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setNouveau(selection)}>
              Nouvel événement
            </Button>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exporter} disabled={events.length === 0}>
              Exporter vers Google Agenda / Outlook
            </Button>
          </>
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
                        <span key={e.id} className={clsx("h-1.5 w-1.5 rounded-full", e.done ? "bg-slate-300" : classesOf(e).dot)} />
                      ))}
                    </span>
                    <span className="hidden flex-col gap-1 sm:flex">
                      {evs.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={clsx(
                            "truncate rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                            e.done ? "bg-slate-50 text-slate-400 ring-slate-200 line-through" : classesOf(e).chip,
                          )}
                        >
                          {e.heure ? `${e.heure.slice(0, 5)} ` : ""}
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
            <EventList events={parJour.get(selection) ?? []} empty="Rien de prévu ce jour-là." onOpen={setOuvert} />
            <Button variant="ghost" size="sm" className="mt-3" icon={<Plus className="h-4 w-4" />} onClick={() => setNouveau(selection)}>
              Ajouter un événement ce jour
            </Button>
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
              <EventList events={evs} onOpen={setOuvert} />
            </Card>
          ))}
        </div>
      )}

      {nouveau && (
        <RdvDialog
          date={nouveau}
          onClose={() => setNouveau(null)}
          onSaved={(date) => {
            setNouveau(null);
            setSelection(date);
            setMois({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
          }}
        />
      )}

      {ouvert && (
        <EventDialog
          event={ouvert}
          onClose={() => setOuvert(null)}
          onMoved={(date) => {
            setOuvert(null);
            setSelection(date);
            setMois({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
          }}
        />
      )}
    </>
  );
}

const DATE_LABEL: Record<string, string> = {
  livraison: "Date de livraison",
  retour: "Date de retour",
  fin: "Date de fin de contrat",
  sav: "Date",
};

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

/** Formulaire d'un événement créé à la main (création ou modification). */
function RdvForm({
  initial,
  onSubmit,
  submitLabel,
  extra,
}: {
  initial: Omit<CalendarItem, "id" | "creeLe">;
  onSubmit: (v: Omit<CalendarItem, "id" | "creeLe">) => void;
  submitLabel: string;
  extra?: React.ReactNode;
}) {
  const { data } = useStore();
  const [v, setV] = useState(initial);
  const [numero, setNumero] = useState(() => data.modules.find((m) => m.id === initial.moduleId)?.numero ?? "");
  const [error, setError] = useState("");
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }));
  const contrats = data.contrats;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.titre.trim()) return setError("Donnez un titre à l'événement.");
    if (!v.date) return setError("Choisissez une date.");
    let moduleId: string | undefined;
    if (numero.trim()) {
      const m = data.modules.find((x) => x.numero.toLowerCase() === numero.trim().toLowerCase());
      if (!m) return setError(`Le module ${numero.trim()} n'est pas dans le parc.`);
      moduleId = m.id;
    }
    onSubmit({
      ...v,
      titre: v.titre.trim(),
      lieu: v.lieu?.trim() || undefined,
      note: v.note?.trim() || undefined,
      heureDebut: v.heureDebut || undefined,
      heureFin: v.heureDebut && v.heureFin ? v.heureFin : undefined,
      contratId: v.contratId || undefined,
      moduleId,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Titre" required>
        <Input value={v.titre} onChange={(e) => set("titre", e.target.value)} placeholder="ex. Rendez-vous avec le conducteur de travaux" autoFocus />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">Couleur</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur">
          {COULEURS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={v.couleur === c}
              aria-label={COULEUR_CLASSES[c].label}
              title={COULEUR_CLASSES[c].label}
              onClick={() => set("couleur", c)}
              className={clsx(
                "h-8 w-8 rounded-full ring-offset-2 transition",
                COULEUR_CLASSES[c].dot,
                v.couleur === c ? "ring-2 ring-slate-900" : "hover:scale-110",
              )}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Date" required>
          <Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Début">
          <Input type="time" value={v.heureDebut ?? ""} onChange={(e) => set("heureDebut", e.target.value)} />
        </Field>
        <Field label="Fin">
          <Input type="time" value={v.heureFin ?? ""} onChange={(e) => set("heureFin", e.target.value)} disabled={!v.heureDebut} />
        </Field>
      </div>
      <Field label="Lieu">
        <Input value={v.lieu ?? ""} onChange={(e) => set("lieu", e.target.value)} placeholder="Adresse ou nom du chantier" />
      </Field>
      <Field label="Note">
        <Textarea rows={2} value={v.note ?? ""} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Contrat (facultatif)">
          <Select value={v.contratId ?? ""} onChange={(e) => set("contratId", e.target.value)}>
            <option value="">Aucun</option>
            {contrats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} · {c.client}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Module (facultatif)">
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="N° de parc" list="rdv-modules" />
          <datalist id="rdv-modules">
            {data.modules.slice(0, 500).map((m) => (
              <option key={m.id} value={m.numero} />
            ))}
          </datalist>
        </Field>
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{submitLabel}</Button>
        {extra}
      </div>
    </form>
  );
}

function RdvDialog({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: (date: string) => void }) {
  const { addRendezvous } = useStore();
  return (
    <Modal label="Nouvel événement" onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="font-semibold text-slate-900">Nouvel événement</p>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </div>
      <RdvForm
        initial={{ titre: "", couleur: "vert", date }}
        submitLabel="Créer l'événement"
        onSubmit={(v) => {
          addRendezvous(v);
          onSaved(v.date);
        }}
      />
    </Modal>
  );
}

const AUTEUR_KEY = "loc-and-go:auteur";

function Comments({ eventKey }: { eventKey: string }) {
  const { data, addComment, deleteComment } = useStore();
  const [auteur, setAuteur] = useState(() => {
    try {
      return localStorage.getItem(AUTEUR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [texte, setTexte] = useState("");
  const liste = (data.commentaires ?? []).filter((c) => c.eventKey === eventKey);

  const envoyer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texte.trim()) return;
    try {
      localStorage.setItem(AUTEUR_KEY, auteur.trim());
    } catch {
      /* rien */
    }
    addComment(eventKey, auteur || "Anonyme", texte);
    setTexte("");
  };

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <MessageSquare className="h-4 w-4" /> Commentaires
      </p>
      {liste.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">Aucun commentaire. Laissez une info pour l&apos;équipe (accès, horaires, matériel à prévoir…).</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {liste.map((c) => (
            <li key={c.id} className="group rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  <strong className="text-slate-700">{c.auteur}</strong> ·{" "}
                  {new Date(c.date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  type="button"
                  onClick={() => deleteComment(c.id)}
                  className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-rose-600"
                  aria-label="Supprimer le commentaire"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-800">{c.texte}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={envoyer} className="space-y-2">
        <Input value={auteur} onChange={(e) => setAuteur(e.target.value)} placeholder="Votre nom" aria-label="Votre nom" />
        <Textarea rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Écrire un commentaire…" aria-label="Commentaire" />
        <Button type="submit" size="sm" variant="secondary" disabled={!texte.trim()}>
          Ajouter le commentaire
        </Button>
      </form>
    </div>
  );
}

function EventDialog({ event, onClose, onMoved }: { event: CalendarEvent; onClose: () => void; onMoved: (date: string) => void }) {
  const { data, setDeliveryDate, setReturnDate, setContractDateFin, moveComments, updateRendezvous, deleteRendezvous } = useStore();
  const [date, setDate] = useState(event.date);
  const [error, setError] = useState("");
  const rdv = event.rdvId ? (data.rendezvous ?? []).find((r) => r.id === event.rdvId) : undefined;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return setError("Choisissez une date.");
    if (!event.contratId) return;
    if (event.kind === "livraison") {
      setDeliveryDate(event.contratId, event.date, date);
      moveComments(event.id, `liv-${event.contratId}-${date}`);
    }
    if (event.kind === "retour") {
      setReturnDate(event.contratId, event.date, date);
      moveComments(event.id, `ret-${event.contratId}-${date}`);
    }
    if (event.kind === "fin") setContractDateFin(event.contratId, date);
    onMoved(date);
  };

  return (
    <Modal label={event.title} onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={clsx("mt-1.5 h-2.5 w-2.5 flex-none rounded-full", classesOf(event).dot)} />
          <div>
            <p className="font-semibold text-slate-900">{event.title}</p>
            {!rdv && event.detail && <p className="text-sm text-slate-500">{event.detail}</p>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </div>

      {rdv ? (
        <RdvForm
          initial={{
            titre: rdv.titre,
            couleur: couleurDe(rdv),
            date: rdv.date,
            heureDebut: rdv.heureDebut,
            heureFin: rdv.heureFin,
            lieu: rdv.lieu,
            note: rdv.note,
            contratId: rdv.contratId,
            moduleId: rdv.moduleId,
          }}
          submitLabel="Enregistrer"
          onSubmit={(v) => {
            updateRendezvous(rdv.id, v);
            onMoved(v.date);
          }}
          extra={
            <>
              {event.href && (
                <ButtonLink href={event.href} variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
                  Ouvrir
                </ButtonLink>
              )}
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  if (window.confirm("Supprimer cet événement ?")) {
                    deleteRendezvous(rdv.id);
                    onClose();
                  }
                }}
              >
                Supprimer
              </Button>
            </>
          }
        />
      ) : event.editable ? (
        <form onSubmit={save} className="space-y-4">
          <Field
            label={DATE_LABEL[event.kind] ?? "Date"}
            hint={
              event.kind === "livraison"
                ? "S'applique aux modules de ce contrat pas encore livrés, et à l'atelier."
                : event.kind === "fin"
                  ? "S'applique à tous les modules encore sur place."
                  : "S'applique aux modules dont le retour est prévu ce jour-là."
            }
          >
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {error && <Alert tone="red">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={date === event.date}>
              Enregistrer la nouvelle date
            </Button>
            <ButtonLink href={event.href} variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
              Ouvrir
            </ButtonLink>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {event.kind === "sav" ? "Date de réception de la demande : elle ne se déplace pas." : "Livraison effectuée : la date n'est plus modifiable."}
          </p>
          <ButtonLink href={event.href} variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
            Ouvrir
          </ButtonLink>
        </div>
      )}

      <Comments eventKey={event.id} />
    </Modal>
  );
}

function EventList({ events, empty, onOpen }: { events: CalendarEvent[]; empty?: string; onOpen: (e: CalendarEvent) => void }) {
  const { data } = useStore();
  const nbComments = (key: string) => (data.commentaires ?? []).filter((c) => c.eventKey === key).length;
  if (events.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id}>
          <button type="button" onClick={() => onOpen(e)} className="-mx-2 flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50">
            <span className={clsx("mt-1.5 h-2.5 w-2.5 flex-none rounded-full", e.done ? "bg-slate-300" : classesOf(e).dot)} />
            <span className="min-w-0">
              <span className={clsx("block text-sm font-medium", e.done ? "text-slate-400 line-through" : "text-slate-900")}>{e.title}</span>
              {e.detail && <span className="block text-xs text-slate-500">{e.detail}</span>}
              <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] font-medium">
                {e.editable && <span className="text-brand-600">{e.rdvId ? "Modifier" : "Modifier la date"}</span>}
                {nbComments(e.id) > 0 && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <MessageSquare className="h-3 w-3" /> {nbComments(e.id)} commentaire(s)
                  </span>
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
