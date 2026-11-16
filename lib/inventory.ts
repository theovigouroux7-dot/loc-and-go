import { DEFAULT_EQUIPEMENTS } from "./status";
import type { AppData, ContractLine, EquipementDef, Preparation, Settings } from "./types";

/** Libellé d'un équipement retenu, avec sa quantité s'il se compte (ex. « Chaise × 8 »). */
export function equipementLabel(nom: string, quantite: number, quantifiable: boolean): string {
  return quantifiable ? `${nom} × ${quantite}` : nom;
}

/**
 * Inventaire final d'un module tel que validé par l'atelier : équipements obligatoires vérifiés,
 * puis équipements optionnels retenus. C'est cette liste que le client signe et que l'atelier contrôle au retour.
 */
export function inventaireFinal(prep: Preparation | undefined, settings: Settings): string[] {
  if (!prep) return [];
  const defs = new Map(settings.equipements.map((e) => [e.nom, e]));
  const obligatoires = Object.entries(prep.inventaire ?? {})
    .filter(([, ok]) => ok)
    .map(([nom]) => nom);
  const optionnels = Object.entries(prep.equipements ?? {})
    .filter(([, q]) => q > 0)
    .map(([nom, q]) => equipementLabel(nom, q, defs.get(nom)?.quantifiable ?? q > 1));
  return [...obligatoires, ...optionnels];
}

/** Inventaire de référence d'une ligne : celui signé par le client, sinon celui de l'atelier. */
export function inventaireReference(ligne: ContractLine, settings: Settings): string[] {
  const signe = Object.keys(ligne.reception?.inventaire ?? {});
  if (signe.length) return signe;
  return inventaireFinal(ligne.preparation, settings);
}

export function obligatoires(settings: Settings): EquipementDef[] {
  return settings.equipements.filter((e) => e.obligatoire);
}

export function optionnels(settings: Settings): EquipementDef[] {
  return settings.equipements.filter((e) => !e.obligatoire);
}

/** Met à niveau des données enregistrées par une version précédente du prototype. */
export function migrate(raw: AppData & { parametres: Settings & { inventaire?: string[] } }): AppData {
  const parametres = { ...raw.parametres };
  if (!Array.isArray(parametres.equipements) || parametres.equipements.length === 0) {
    parametres.equipements = Array.isArray(parametres.inventaire)
      ? parametres.inventaire.map((nom) => ({ nom, obligatoire: true, quantifiable: false }))
      : DEFAULT_EQUIPEMENTS;
  }
  delete (parametres as { inventaire?: string[] }).inventaire;
  const lignes = (raw.lignes ?? []).map((l) =>
    l.preparation ? { ...l, preparation: { ...l.preparation, inventaire: l.preparation.inventaire ?? {}, equipements: l.preparation.equipements ?? {} } } : l,
  );
  return { ...raw, version: 2, parametres, lignes };
}
