export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix ? `${prefix}_${rand}` : rand;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
export function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Formate une date AAAA-MM-JJ ou ISO en « 16 nov. 2026 ». */
export function formatDate(value?: string): string {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00`).getTime();
  const b = new Date(`${toIso}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Normalise un numéro de module pour les comparaisons (espaces, casse). */
export function normalizeNumero(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Tente de lire une date venant d'Excel ou d'un CSV (JJ/MM/AAAA, AAAA-MM-JJ, numéro de série Excel). */
export function parseLooseDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const ms = Math.round((value - 25569) * 86_400_000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (fr) {
    const year = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
    return `${year}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return "";
}

/** Adresse encodée dans le QR code d'un matériel. L'espace principal garde les anciennes adresses /m/<id>. */
export function moduleUrl(moduleId: string, slug = "principal"): string {
  const path = slug === "principal" ? `/m/${moduleId}` : `/q/${slug}/${moduleId}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

/** Extrait l'identifiant de module d'un contenu de QR code (URL /m/<id>) ; sinon renvoie le texte brut. */
export function parseScan(text: string): { moduleId?: string; raw: string } {
  const raw = text.trim();
  const match = raw.match(/\/q\/[a-z0-9]+\/([A-Za-z0-9_-]+)/) ?? raw.match(/\/m\/([A-Za-z0-9_-]+)/);
  if (match) return { moduleId: match[1], raw };
  return { raw };
}

/**
 * Interprète une cellule « statut » d'un export de parc (ex. « En loc », « Loué », « Dispo », « En réparation »).
 * Renvoie le statut à appliquer au module, ou null si la valeur ne dit rien de clair.
 */
export function parseStatutLocation(value: string): "loue" | "disponible" | "a_remettre" | null {
  const v = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!v) return null;
  if (/repar|\bhs\b|hors service|a remettre|sav|maintenance/.test(v)) return "a_remettre";
  if (/dispo|libre|stock|parc|depot|vacant/.test(v)) return "disponible";
  if (/loc|loue|chantier|client|sorti|en cours|^oui$|^o$|^x$|^1$/.test(v)) return "loue";
  return null;
}
