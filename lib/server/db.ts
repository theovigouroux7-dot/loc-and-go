// Accès à la base Supabase depuis le serveur uniquement, avec la clé « service » (jamais envoyée au navigateur).
// Toutes les lectures et écritures sont filtrées par espace : un loueur ne voit jamais les données d'un autre.
import "server-only";

const URL_BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

export const dbConfigured = Boolean(URL_BASE);
export const dbReady = Boolean(URL_BASE && KEY);

export const ESPACE_PRINCIPAL = "principal";
export const LIMITE_ESSAI = 50;

export type Plan = "essai" | "complet";

export interface Espace {
  slug: string;
  nom: string;
  code: string;
  plan: Plan;
  cree_le?: string;
  derniere_connexion?: string | null;
}

export interface DemoRequest {
  id: string;
  cree_le?: string;
  nom: string;
  societe: string;
  telephone: string;
  email: string;
  message: string;
  espace: string;
  traitee: boolean;
}

export interface Row {
  id: string;
  kind: string;
  data: unknown;
  updated_at?: string;
}

export class DbError extends Error {}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: KEY, "Content-Type": "application/json", ...extra };
  if (KEY.startsWith("eyJ")) h.Authorization = `Bearer ${KEY}`;
  return h;
}

async function rest(path: string, init: RequestInit = {}, extra: Record<string, string> = {}): Promise<Response> {
  if (!dbReady) throw new DbError("La clé SUPABASE_SERVICE_ROLE_KEY n'est pas configurée dans Vercel.");
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: headers(extra), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DbError(`Base de données : ${res.status} ${text.slice(0, 200)}`);
  }
  return res;
}

const enc = encodeURIComponent;
const PAGE = 1000;

async function getAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await rest(path, { method: "GET" }, { Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" });
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// --- Espaces -----------------------------------------------------------------------------

export async function getEspace(slug: string): Promise<Espace | undefined> {
  const res = await rest(`espaces?select=*&slug=eq.${enc(slug)}`, { method: "GET" });
  return ((await res.json()) as Espace[])[0];
}

export async function listEspaces(): Promise<Espace[]> {
  return getAll<Espace>("espaces?select=*&order=cree_le.asc,slug.asc");
}

export async function insertEspaces(espaces: Espace[]): Promise<void> {
  await rest("espaces", { method: "POST", body: JSON.stringify(espaces) }, { Prefer: "return=minimal" });
}

export async function updateEspace(slug: string, patch: Partial<Espace>): Promise<void> {
  await rest(`espaces?slug=eq.${enc(slug)}`, { method: "PATCH", body: JSON.stringify(patch) }, { Prefer: "return=minimal" });
}

export async function deleteEspace(slug: string): Promise<void> {
  await deleteAllData(slug);
  await rest(`espaces?slug=eq.${enc(slug)}`, { method: "DELETE" }, { Prefer: "return=minimal" });
}

/** Nombre de matériels par espace (pour la page admin). */
export async function countModulesParEspace(): Promise<Record<string, number>> {
  const rows = await getAll<{ espace_id: string }>("records?select=espace_id&kind=eq.module");
  const out: Record<string, number> = {};
  for (const r of rows) out[r.espace_id] = (out[r.espace_id] ?? 0) + 1;
  return out;
}

// --- Données d'un espace -------------------------------------------------------------------

export async function fetchRows(slug: string, since?: string): Promise<Row[]> {
  const filter = since ? `&updated_at=gt.${enc(since)}` : "";
  return getAll<Row>(`records?select=id,kind,data,updated_at&espace_id=eq.${enc(slug)}${filter}&order=updated_at.asc,id.asc`);
}

export async function moduleIds(slug: string): Promise<string[]> {
  const rows = await getAll<{ id: string }>(`records?select=id&espace_id=eq.${enc(slug)}&kind=eq.module`);
  return rows.map((r) => r.id);
}

export async function existingIds(slug: string, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const list = chunk.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
    const rows = await getAll<{ id: string; kind: string }>(`records?select=id,kind&espace_id=eq.${enc(slug)}&id=in.(${enc(list)})`);
    for (const r of rows) out.set(r.id, r.kind);
  }
  return out;
}

export async function upsertRows(slug: string, rows: Row[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(({ id, kind, data }) => ({ espace_id: slug, id, kind, data }));
    await rest("records?on_conflict=espace_id,id", { method: "POST", body: JSON.stringify(chunk) }, { Prefer: "resolution=merge-duplicates,return=minimal" });
  }
}

export async function deleteAllData(slug: string): Promise<void> {
  await rest(`records?espace_id=eq.${enc(slug)}`, { method: "DELETE" }, { Prefer: "return=minimal" });
  await rest(`photos?espace_id=eq.${enc(slug)}`, { method: "DELETE" }, { Prefer: "return=minimal" });
}

// --- Photos et documents -----------------------------------------------------------------

export async function getPhoto(slug: string, id: string): Promise<string | undefined> {
  const res = await rest(`photos?select=data&espace_id=eq.${enc(slug)}&id=eq.${enc(id)}`, { method: "GET" });
  return ((await res.json()) as { data: string }[])[0]?.data;
}

export async function putPhoto(slug: string, id: string, data: string): Promise<void> {
  await rest("photos?on_conflict=espace_id,id", { method: "POST", body: JSON.stringify([{ espace_id: slug, id, data }]) }, {
    Prefer: "resolution=merge-duplicates,return=minimal",
  });
}

export async function removePhoto(slug: string, id: string): Promise<void> {
  await rest(`photos?espace_id=eq.${enc(slug)}&id=eq.${enc(id)}`, { method: "DELETE" }, { Prefer: "return=minimal" });
}

// --- Demandes de démo ----------------------------------------------------------------------

export async function insertDemo(d: DemoRequest): Promise<void> {
  await rest("demos", { method: "POST", body: JSON.stringify([d]) }, { Prefer: "return=minimal" });
}

export async function listDemos(): Promise<DemoRequest[]> {
  return getAll<DemoRequest>("demos?select=*&order=cree_le.desc");
}

export async function updateDemo(id: string, patch: Partial<DemoRequest>): Promise<void> {
  await rest(`demos?id=eq.${enc(id)}`, { method: "PATCH", body: JSON.stringify(patch) }, { Prefer: "return=minimal" });
}
