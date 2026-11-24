// Synchronisation avec une base de données en ligne (Supabase, via son API REST).
// Activée seulement si les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont définies ;
// sinon, l'application garde ses données dans le navigateur.
//
// Chaque élément (module, contrat, ligne, demande, événement, paramètres) est une ligne de la table
// « records ». On n'envoie que ce qui a changé, et on récupère régulièrement ce que les autres appareils ont modifié.

import type { AppData, CalendarItem, ClientRequest, Contract, ContractLine, EventComment, HistoryEvent, Module, Settings } from "./types";

const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const remoteEnabled = Boolean(URL_BASE && KEY);

type Kind = "module" | "contrat" | "ligne" | "demande" | "event" | "rdv" | "commentaire" | "settings" | "tombstone";

export interface RecordRow {
  id: string;
  kind: Kind;
  data: unknown;
  updated_at?: string;
}

const SETTINGS_ID = "settings";
const PAGE = 1000;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: KEY, "Content-Type": "application/json", ...extra };
  // Les anciennes clés « anon » sont des JWT ; les nouvelles clés « publishable » s'envoient seulement en apikey.
  if (KEY.startsWith("eyJ")) h.Authorization = `Bearer ${KEY}`;
  return h;
}

async function rest(path: string, init: RequestInit = {}, extra: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: headers(extra), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Base de données : ${res.status} ${text.slice(0, 200)}`);
  }
  return res;
}

/** Lit les enregistrements, tous ou seulement ceux modifiés après `since`, par pages de 1000. */
export async function fetchRecords(since?: string): Promise<RecordRow[]> {
  const out: RecordRow[] = [];
  const filter = since ? `&updated_at=gt.${encodeURIComponent(since)}` : "";
  for (let from = 0; ; from += PAGE) {
    const res = await rest(`records?select=id,kind,data,updated_at&order=updated_at.asc,id.asc${filter}`, { method: "GET" }, {
      Range: `${from}-${from + PAGE - 1}`,
      "Range-Unit": "items",
    });
    const rows = (await res.json()) as RecordRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function upsertRecords(rows: RecordRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(({ id, kind, data }) => ({ id, kind, data }));
    await rest("records?on_conflict=id", { method: "POST", body: JSON.stringify(chunk) }, { Prefer: "resolution=merge-duplicates,return=minimal" });
  }
}

export async function deleteAllRecords(): Promise<void> {
  await rest("records?id=not.is.null", { method: "DELETE" }, { Prefer: "return=minimal" });
  await rest("photos?id=not.is.null", { method: "DELETE" }, { Prefer: "return=minimal" });
}

// --- Photos -------------------------------------------------------------------------

export async function uploadPhoto(id: string, dataUrl: string): Promise<void> {
  await rest("photos?on_conflict=id", { method: "POST", body: JSON.stringify([{ id, data: dataUrl }]) }, {
    Prefer: "resolution=merge-duplicates,return=minimal",
  });
}

export async function downloadPhoto(id: string): Promise<string | undefined> {
  const res = await rest(`photos?select=data&id=eq.${encodeURIComponent(id)}`, { method: "GET" });
  const rows = (await res.json()) as { data: string }[];
  return rows[0]?.data;
}

export async function removePhoto(id: string): Promise<void> {
  await rest(`photos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }, { Prefer: "return=minimal" });
}

// --- Conversion entre l'état de l'application et les enregistrements ------------------

const COLLECTIONS = [
  ["modules", "module"],
  ["contrats", "contrat"],
  ["lignes", "ligne"],
  ["demandes", "demande"],
  ["historique", "event"],
  ["rendezvous", "rdv"],
  ["commentaires", "commentaire"],
] as const;

type CollectionKey = (typeof COLLECTIONS)[number][0];

/** Enregistrements à envoyer pour passer de `prev` à `next` (éléments ajoutés, modifiés ou supprimés). */
export function diffData(prev: AppData, next: AppData): RecordRow[] {
  const rows: RecordRow[] = [];
  for (const [key, kind] of COLLECTIONS) {
    const before = new Map<string, unknown>(((prev[key] ?? []) as { id: string }[]).map((x) => [x.id, x]));
    const nextIds = new Set<string>();
    for (const item of (next[key] ?? []) as { id: string }[]) {
      nextIds.add(item.id);
      if (before.get(item.id) !== item) rows.push({ id: item.id, kind, data: item });
    }
    for (const id of Array.from(before.keys())) {
      if (!nextIds.has(id)) rows.push({ id, kind: "tombstone", data: null });
    }
  }
  if (prev.parametres !== next.parametres) rows.push({ id: SETTINGS_ID, kind: "settings", data: next.parametres });
  return rows;
}

/** Applique des enregistrements reçus de la base à l'état courant. */
export function applyRecords(base: AppData, rows: RecordRow[]): AppData {
  if (rows.length === 0) return base;
  const maps = Object.fromEntries(
    COLLECTIONS.map(([key]) => [key, new Map(((base[key] ?? []) as { id: string }[]).map((x) => [x.id, x]))]),
  ) as Record<CollectionKey, Map<string, unknown>>;
  let parametres = base.parametres;

  for (const row of rows) {
    if (row.kind === "settings") {
      parametres = { ...base.parametres, ...(row.data as Settings) };
      continue;
    }
    if (row.kind === "tombstone") {
      for (const [key] of COLLECTIONS) maps[key].delete(row.id);
      continue;
    }
    const entry = COLLECTIONS.find(([, kind]) => kind === row.kind);
    if (entry && row.data) maps[entry[0]].set(row.id, row.data);
  }

  return sortData({
    ...base,
    parametres,
    modules: Array.from(maps.modules.values()) as Module[],
    contrats: Array.from(maps.contrats.values()) as Contract[],
    lignes: Array.from(maps.lignes.values()) as ContractLine[],
    demandes: Array.from(maps.demandes.values()) as ClientRequest[],
    historique: Array.from(maps.historique.values()) as HistoryEvent[],
    rendezvous: Array.from(maps.rendezvous.values()) as CalendarItem[],
    commentaires: Array.from(maps.commentaires.values()) as EventComment[],
  });
}

/** Ordre stable des listes, quel que soit l'ordre d'arrivée des enregistrements. */
export function sortData(d: AppData): AppData {
  const byKey = <T,>(get: (x: T) => string) => (a: T, b: T) => get(a).localeCompare(get(b));
  return {
    ...d,
    modules: [...d.modules].sort(byKey<Module>((m) => `${m.creeLe}|${m.id}`)),
    contrats: [...d.contrats].sort(byKey<Contract>((c) => `${c.creeLe}|${c.id}`)),
    lignes: [...d.lignes].sort(byKey<ContractLine>((l) => `${l.creeLe ?? ""}|${l.id}`)),
    demandes: [...d.demandes].sort((a, b) => b.creeeLe.localeCompare(a.creeeLe)),
    historique: [...d.historique].sort((a, b) => b.date.localeCompare(a.date)),
    rendezvous: [...(d.rendezvous ?? [])].sort(byKey<CalendarItem>((r) => `${r.date}|${r.heureDebut ?? ""}|${r.id}`)),
    commentaires: [...(d.commentaires ?? [])].sort(byKey<EventComment>((c) => `${c.date}|${c.id}`)),
  };
}
