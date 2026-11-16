// Modèle de données de Loc and Go.
// Un contrat est une liste de lignes : chaque ligne réunit un module, une date de début et une date de fin.

export type ModuleStatus =
  | "disponible"
  | "reserve"
  | "preparation"
  | "pret"
  | "loue"
  | "retour_demande"
  | "en_retour"
  | "a_remettre"
  | "reparation";

export type LineStatus =
  | "a_preparer" // la ligne attend qu'un module y soit affecté
  | "en_preparation" // un module est lié, préparation en cours
  | "prete" // inventaire validé, en attente de la date de livraison
  | "en_cours" // date de livraison passée : le module est chez le client
  | "retour_demande" // le client ou le bureau a demandé le retour
  | "retournee" // module revenu au parc, constat en cours
  | "cloturee"; // constat terminé

export interface Module {
  id: string;
  numero: string; // numéro de parc saisi ou importé par le loueur
  type: string;
  dimensions: string;
  equipements: string;
  depot: string;
  statut: ModuleStatus;
  ligneId: string | null; // ligne de contrat en cours
  creeLe: string;
}

export interface InventaireCoche {
  [item: string]: boolean;
}

export interface Preparation {
  photos: string[]; // identifiants de photos
  inventaire: InventaireCoche; // équipements obligatoires : coché = vérifié
  equipements: Record<string, number>; // équipements optionnels retenus par l'atelier, avec leur quantité
  valideeLe?: string;
}

export interface Reception {
  inventaire: InventaireCoche; // clé = libellé de l'inventaire final (ex. « Chaise × 8 »)
  reserves: string;
  photos: string[];
  nom: string;
  signature: string; // image PNG en data URL
  signeeLe: string;
}

export interface Constat {
  inventaire: InventaireCoche; // coché = présent au retour
  degats: string;
  photos: string[];
  intact: boolean;
  faitLe: string;
}

export interface ContractLine {
  id: string;
  contratId: string;
  typeDemande: string;
  moduleId: string | null;
  dateDebut: string; // AAAA-MM-JJ
  dateFin: string; // AAAA-MM-JJ, vide si inconnue
  statut: LineStatus;
  creeLe?: string;
  preparation?: Preparation;
  reception?: Reception;
  dateRetourSouhaitee?: string;
  constat?: Constat;
}

export interface Contract {
  id: string;
  reference: string;
  client: string;
  adresse: string;
  ville: string;
  dateLivraison: string;
  dateFin: string;
  notes: string;
  importe: boolean; // contrat repris lors de l'import du parc
  creeLe: string;
}

export type RequestType = "sav" | "retour";

export interface ClientRequest {
  id: string;
  type: RequestType;
  moduleId: string;
  ligneId: string;
  message: string;
  dateSouhaitee?: string;
  photos: string[];
  creeeLe: string;
  traitee: boolean;
}

export type EventKind =
  | "import"
  | "ajout"
  | "contrat"
  | "affectation"
  | "preparation"
  | "location"
  | "reception"
  | "sav"
  | "retour_demande"
  | "retour"
  | "constat"
  | "reparation"
  | "disponible"
  | "modification";

export interface HistoryEvent {
  id: string;
  date: string;
  kind: EventKind;
  message: string;
  moduleId?: string;
  contratId?: string;
}

export interface EquipementDef {
  nom: string;
  obligatoire: boolean; // présent dans tous les modules : l'atelier le vérifie
  quantifiable: boolean; // se compte à l'unité (tables, chaises…)
}

export interface Settings {
  nomLoueur: string;
  equipements: EquipementDef[];
  delaiReservesJours: number;
}

export interface AppData {
  version: number;
  modules: Module[];
  contrats: Contract[];
  lignes: ContractLine[];
  demandes: ClientRequest[];
  historique: HistoryEvent[];
  parametres: Settings;
}
