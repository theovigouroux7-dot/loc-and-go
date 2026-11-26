// Page client du QR code : seules les données du contrat du matériel scanné sont visibles et modifiables.
import "server-only";
import { existingIds, fetchRows, type Espace, type Row } from "./db";

interface Sous {
  rows: Row[];
  modules: Set<string>;
  lignes: Set<string>;
  demandes: Set<string>;
  contrat?: string;
}

const data = <T,>(r: Row) => r.data as T;

export async function sousEnsemble(espace: Espace, moduleId: string): Promise<Sous> {
  const rows = await fetchRows(espace.slug);
  const parKind = (k: string) => rows.filter((r) => r.kind === k);
  const modules = new Map(parKind("module").map((r) => [r.id, r]));
  const lignes = parKind("ligne");
  const settings = rows.find((r) => r.kind === "settings");

  const out: Sous = { rows: [], modules: new Set(), lignes: new Set(), demandes: new Set() };
  if (settings) {
    // Version d'essai : pas de prestations complémentaires dans l'espace client.
    const s = data<Record<string, unknown>>(settings);
    out.rows.push(espace.plan === "essai" ? { ...settings, data: { ...s, offres: [] } } : settings);
  }
  const mod = modules.get(moduleId);
  if (!mod) return out;
  out.modules.add(mod.id);

  const ligneId = data<{ ligneId?: string | null }>(mod).ligneId;
  const ligne = ligneId ? lignes.find((l) => l.id === ligneId) : undefined;
  const contratId = ligne ? data<{ contratId: string }>(ligne).contratId : undefined;
  if (contratId) {
    out.contrat = contratId;
    const contrat = rows.find((r) => r.kind === "contrat" && r.id === contratId);
    if (contrat) out.rows.push(contrat);
    for (const l of lignes) {
      const d = data<{ contratId: string; moduleId?: string | null }>(l);
      if (d.contratId !== contratId) continue;
      out.lignes.add(l.id);
      out.rows.push(l);
      if (d.moduleId) out.modules.add(d.moduleId);
    }
  }
  for (const id of Array.from(out.modules)) {
    const m = modules.get(id);
    if (m) out.rows.push(m);
  }
  for (const r of parKind("demande")) {
    const d = data<{ moduleId?: string; ligneId?: string }>(r);
    if ((d.moduleId && out.modules.has(d.moduleId)) || (d.ligneId && out.lignes.has(d.ligneId))) {
      out.demandes.add(r.id);
      out.rows.push(r);
    }
  }
  return out;
}

/** Garde seulement les écritures autorisées depuis la page client. */
export async function filtrerEcritures(espace: Espace, moduleId: string, rows: Row[]): Promise<Row[]> {
  const s = await sousEnsemble(espace, moduleId);
  const nouveaux = rows.filter((r) => r.kind === "demande" || r.kind === "event").map((r) => r.id);
  const existants = await existingIds(espace.slug, nouveaux);
  return rows.filter((r) => {
    if (!r || typeof r.id !== "string") return false;
    switch (r.kind) {
      case "module":
        return s.modules.has(r.id);
      case "ligne":
        return s.lignes.has(r.id);
      case "demande":
        return !existants.has(r.id) || s.demandes.has(r.id);
      case "event":
        return !existants.has(r.id);
      default:
        return false;
    }
  });
}
