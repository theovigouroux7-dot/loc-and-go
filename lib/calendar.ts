import type { AppData, RdvCouleur } from "./types";
import { termes } from "./terms";
import { addDays, today } from "./utils";

export type EventKind = "livraison" | "retour" | "fin" | "sav" | "perso";

/** Couleurs proposées pour les événements créés à la main. */
export const COULEURS: RdvCouleur[] = ["vert", "turquoise", "orange", "indigo", "rose", "jaune", "marron", "gris"];

export const COULEUR_CLASSES: Record<RdvCouleur, { dot: string; chip: string; label: string }> = {
  vert: { label: "Vert", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  turquoise: { label: "Turquoise", dot: "bg-teal-500", chip: "bg-teal-50 text-teal-800 ring-teal-200" },
  orange: { label: "Orange", dot: "bg-orange-500", chip: "bg-orange-50 text-orange-900 ring-orange-200" },
  indigo: { label: "Indigo", dot: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  rose: { label: "Rose", dot: "bg-pink-500", chip: "bg-pink-50 text-pink-800 ring-pink-200" },
  jaune: { label: "Jaune", dot: "bg-yellow-400", chip: "bg-yellow-50 text-yellow-900 ring-yellow-200" },
  marron: { label: "Marron", dot: "bg-amber-800", chip: "bg-orange-100 text-amber-900 ring-amber-300" },
  gris: { label: "Gris", dot: "bg-slate-500", chip: "bg-slate-100 text-slate-700 ring-slate-300" },
};

/** Couleur d'un événement créé à la main (les anciens événements « par type » reçoivent une couleur équivalente). */
export function couleurDe(r: { couleur?: string; type?: string }): RdvCouleur {
  if (r.couleur && r.couleur in COULEUR_CLASSES) return r.couleur as RdvCouleur;
  const ancien: Record<string, RdvCouleur> = { rdv: "vert", visite: "turquoise", intervention: "orange", transport: "indigo", autre: "gris" };
  return ancien[r.type ?? ""] ?? "vert";
}

export interface CalendarEvent {
  id: string;
  date: string; // AAAA-MM-JJ
  kind: EventKind;
  title: string;
  detail: string;
  href: string;
  done: boolean; // événement passé ou déjà traité (affiché en grisé)
  contratId?: string;
  rdvId?: string; // événement créé à la main
  couleur?: RdvCouleur;
  heure?: string; // « 09:00 » ou « 09:00 – 10:30 »
  editable: boolean; // la date peut être modifiée depuis le planning
}

export const KIND_LABEL: Record<EventKind, string> = {
  livraison: "Livraisons",
  retour: "Retours",
  fin: "Fins de contrat",
  sav: "SAV",
  perso: "Mes événements",
};

export const KIND_CLASSES: Record<EventKind, { dot: string; chip: string }> = {
  livraison: { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-800 ring-sky-200" },
  retour: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-900 ring-amber-200" },
  fin: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-800 ring-rose-200" },
  sav: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-800 ring-violet-200" },
  perso: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
};

/** Classes d'affichage d'un événement : sa couleur choisie, ou celle de sa catégorie. */
export function classesOf(e: CalendarEvent): { dot: string; chip: string } {
  return e.couleur ? COULEUR_CLASSES[e.couleur] : KIND_CLASSES[e.kind];
}

/** Construit les événements du planning à partir des contrats, lignes et demandes. */
export function buildEvents(data: AppData): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const contrats = new Map(data.contrats.map((c) => [c.id, c]));
  const day = today();
  const t = termes(data.parametres.terme);
  const lieu = (id: string) => {
    const c = contrats.get(id);
    return [c?.client, c?.ville].filter(Boolean).join(" · ");
  };

  // Livraisons : une par contrat et par date.
  const livraisons = new Map<string, { contratId: string; date: string; total: number; aPreparer: number; livres: number }>();
  for (const l of data.lignes) {
    if (!l.dateDebut) continue;
    const key = `${l.contratId}|${l.dateDebut}`;
    const g = livraisons.get(key) ?? { contratId: l.contratId, date: l.dateDebut, total: 0, aPreparer: 0, livres: 0 };
    g.total += 1;
    if (l.statut === "a_preparer" || l.statut === "en_preparation") g.aPreparer += 1;
    if (!["a_preparer", "en_preparation", "prete"].includes(l.statut)) g.livres += 1;
    livraisons.set(key, g);
  }
  for (const g of Array.from(livraisons.values())) {
    const c = contrats.get(g.contratId);
    const done = g.livres === g.total;
    events.push({
      id: `liv-${g.contratId}-${g.date}`,
      date: g.date,
      kind: "livraison",
      title: `Livraison ${c?.reference ?? ""} · ${t.n(g.total)}`,
      detail: [lieu(g.contratId), g.aPreparer ? `${g.aPreparer} encore à préparer` : done ? "livré" : "prêts au départ"].filter(Boolean).join(" · "),
      href: g.aPreparer ? `/atelier/contrat/${g.contratId}` : `/contrats/${g.contratId}`,
      done,
      contratId: g.contratId,
      editable: !done,
    });
  }

  // Retours demandés : un par contrat et par date souhaitée.
  const retours = new Map<string, { contratId: string; date: string; n: number }>();
  for (const l of data.lignes) {
    if (l.statut !== "retour_demande" || !l.dateRetourSouhaitee) continue;
    const key = `${l.contratId}|${l.dateRetourSouhaitee}`;
    const g = retours.get(key) ?? { contratId: l.contratId, date: l.dateRetourSouhaitee, n: 0 };
    g.n += 1;
    retours.set(key, g);
  }
  for (const g of Array.from(retours.values())) {
    const c = contrats.get(g.contratId);
    events.push({
      id: `ret-${g.contratId}-${g.date}`,
      date: g.date,
      kind: "retour",
      title: `Retour ${c?.reference ?? ""} · ${t.n(g.n)}`,
      detail: lieu(g.contratId),
      href: `/contrats/${g.contratId}`,
      done: false,
      contratId: g.contratId,
      editable: true,
    });
  }

  // Fins de contrat, pour les contrats qui ont encore des modules sur place.
  for (const c of data.contrats) {
    if (!c.dateFin) continue;
    const surPlace = data.lignes.filter((l) => l.contratId === c.id && ["prete", "en_cours"].includes(l.statut)).length;
    if (surPlace === 0) continue;
    events.push({
      id: `fin-${c.id}`,
      date: c.dateFin,
      kind: "fin",
      title: `Fin du contrat ${c.reference} · ${t.n(surPlace)}`,
      detail: [c.client, c.ville, c.dateFin < day ? "date dépassée" : ""].filter(Boolean).join(" · "),
      href: `/contrats/${c.id}`,
      done: false,
      contratId: c.id,
      editable: true,
    });
  }

  // Demandes de SAV, au jour où elles ont été reçues.
  for (const d of data.demandes) {
    if (d.type !== "sav") continue;
    const m = data.modules.find((x) => x.id === d.moduleId);
    const l = data.lignes.find((x) => x.id === d.ligneId);
    events.push({
      id: `sav-${d.id}`,
      date: d.creeeLe.slice(0, 10),
      kind: "sav",
      title: `SAV ${t.s} ${m?.numero ?? ""}`,
      detail: [d.message, l ? lieu(l.contratId) : ""].filter(Boolean).join(" · "),
      href: "/demandes",
      done: d.traitee,
      editable: false,
    });
  }

  // Événements créés à la main.
  for (const r of data.rendezvous ?? []) {
    const c = r.contratId ? contrats.get(r.contratId) : undefined;
    const m = r.moduleId ? data.modules.find((x) => x.id === r.moduleId) : undefined;
    const heure = r.heureDebut ? (r.heureFin ? `${r.heureDebut} – ${r.heureFin}` : r.heureDebut) : undefined;
    events.push({
      id: `rdv-${r.id}`,
      date: r.date,
      kind: "perso",
      couleur: couleurDe(r),
      title: r.titre,
      detail: [heure, r.lieu, c ? `${c.reference} · ${c.client}` : "", m ? `${t.s} ${m.numero}` : "", r.note].filter(Boolean).join(" · "),
      href: c ? `/contrats/${c.id}` : m ? `/parc/${m.id}` : "",
      done: false,
      contratId: r.contratId,
      rdvId: r.id,
      heure,
      editable: true,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.heure ?? "").localeCompare(b.heure ?? "") || a.kind.localeCompare(b.kind));
}

// --- Export iCalendar (Google Agenda, Outlook, Apple Calendrier) ---------------------

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Plie les lignes trop longues comme l'exige le format iCalendar (75 octets environ). */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

export function toIcs(events: CalendarEvent[], nomLoueur: string, origin: string, data?: AppData): string {
  const rdv = new Map((data?.rendezvous ?? []).map((r) => [r.id, r]));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loc and Go//Planning//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`Loc and Go · ${nomLoueur}`)}`,
  ];
  for (const e of events) {
    const start = e.date.replace(/-/g, "");
    const end = addDays(e.date, 1).replace(/-/g, "");
    const r = e.rdvId ? rdv.get(e.rdvId) : undefined;
    const t = (h: string) => `${start}T${h.replace(":", "")}00`;
    const dates = r?.heureDebut
      ? [`DTSTART:${t(r.heureDebut)}`, `DTEND:${t(r.heureFin && r.heureFin > r.heureDebut ? r.heureFin : r.heureDebut)}`]
      : [`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`];
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@loc-and-go`,
      `DTSTAMP:${stamp}`,
      ...dates,
      fold(`SUMMARY:${icsEscape(e.title)}`),
      fold(`DESCRIPTION:${icsEscape([e.detail, origin && e.href ? `${origin}${e.href}` : ""].filter(Boolean).join("\n"))}`),
      ...(r?.lieu ? [fold(`LOCATION:${icsEscape(r.lieu)}`)] : []),
      `CATEGORIES:${icsEscape(KIND_LABEL[e.kind])}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
