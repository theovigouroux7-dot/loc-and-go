// Synchronisation avec la base en ligne, toujours via les routes du serveur (/api/…) :
// le navigateur ne parle jamais directement à Supabase, et le serveur filtre tout par espace.
// Activée si NEXT_PUBLIC_SUPABASE_URL est définie ; sinon, l'application garde ses données dans le navigateur.
//
// Chaque élément (module, contrat, ligne, demande, événement, paramètres) est un enregistrement.
// On n'envoie que ce qui a changé, et on récupère régulièrement ce que les autres appareils ont modifié.

import type { AppData, CalendarItem, ClientRequest, Contract, ContractLine, EventComment, HistoryEvent, Module, Settings } from "./types";

export const remoteEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

type Kind = "module" | "contrat" | "ligne" | "demande" | "event" | "rdv" | "commentaire" | "settings" | "tombstone";

export interface RecordRow {
  id: string;
  kind: Kind;
  data: unknown;
  updated_at?: string;
}

const SETTINGS_ID = "settings";

/** Ce que la page voit : tout l'espace connecté, ou seulement le contrat d'un QR code (page client). */
export type RemoteScope = { mode: "espace" } | { mode: "public"; slug: string; moduleId: string };
let scope: RemoteScope = { mode: "espace" };
export function setRemoteScope(s: RemoteScope): void {
  scope = s;
}

export class RemoteError extends Error {
  constructor(
    message: string,
    public status: number,
    public limite = false,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store", credentials: "same-origin" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; limite?: boolean };
  if (!res.ok) throw new RemoteError(body.error || `Erreur ${res.status}`, res.status, Boolean(body.limite));
  return body;
}

const base = () => (scope.mode === "public" ? `/api/public/${encodeURIComponent(scope.slug)}/${encodeURIComponent(scope.moduleId)}` : "/api/data/records");
const photosBase = () => (scope.mode === "public" ? `/api/public/${encodeURIComponent(scope.slug)}/photos` : "/api/data/photos");

/** Lit les enregistrements, tous ou seulement ceux modifiés après `since`. */
export async function fetchRecords(since?: string): Promise<RecordRow[]> {
  const q = since && scope.mode === "espace" ? `?since=${encodeURIComponent(since)}` : "";
  return (await api<{ rows: RecordRow[] }>(`${base()}${q}`)).rows;
}

export async function upsertRecords(rows: RecordRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(({ id, kind, data }) => ({ id, kind, data }));
    await api(base(), { method: "POST", body: JSON.stringify({ rows: chunk }) });
  }
}

export async function deleteAllRecords(): Promise<void> {
  await api("/api/data/records", { method: "DELETE" });
}

// --- Photos -------------------------------------------------------------------------

export async function uploadPhoto(id: string, dataUrl: string): Promise<void> {
  await api(photosBase(), { method: "POST", body: JSON.stringify({ id, data: dataUrl }) });
}

export async function downloadPhoto(id: string): Promise<string | undefined> {
  return (await api<{ data: string | null }>(`${photosBase()}?id=${encodeURIComponent(id)}`)).data ?? undefined;
}

export async function removePhoto(id: string): Promise<void> {
  if (scope.mode === "public") return;
  await api(`${photosBase()}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
