import type { Terme } from "./terms";
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
  technicien?: string; // nom de la personne qui a fait l'inventaire
  signatureTechnicien?: string; // image PNG en data URL
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
  equipementsPrevus?: Record<string, number>; // équipements prévus au contrat pour ce module
  designation?: string; // désignation du contrat (ex. « Module OPEN SPACE 6,03 x 2,44 m »)
  numeroPrevu?: string; // numéro de module indiqué sur le contrat, s'il y en a un
  preparation?: Preparation;
  reception?: Reception;
  dateRetourSouhaitee?: string;
  constat?: Constat;
}

export interface ContractDocument {
  id: string; // identifiant du fichier (stocké comme les photos)
  nom: string;
  type: "plan" | "contrat" | "autre";
  mime: string;
  ajouteLe: string;
}

export interface ContractAccessoire {
  id: string;
  nom: string; // ex. « Rampe d'accès PMR », « Escalier »
  quantite: number;
  pret: boolean; // coché par l'atelier quand l'accessoire est prêt à partir
  preparePar?: string;
  prepareLe?: string;
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
  documents?: ContractDocument[]; // plan d'implantation, contrat PDF…
  accessoires?: ContractAccessoire[]; // matériel livré en plus des modules, à cocher par l'atelier
  importe: boolean; // contrat repris lors de l'import du parc
  creeLe: string;
}

export type RequestType = "sav" | "retour" | "reserve" | "devis";

export interface ClientRequest {
  id: string;
  type: RequestType;
  moduleId: string;
  moduleIds?: string[]; // réserve ou retour : tous les modules concernés ensemble
  signataire?: string; // réserve : nom du client qui a signé
  ligneId: string;
  ligneIds?: string[]; // retour : toutes les lignes concernées
  offreId?: string; // devis : offre demandée
  offreTitre?: string;
  contact?: string; // devis : nom, téléphone ou e-mail laissé par le client
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
  | "reserve"
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
  obligatoire: boolean; // point de contrôle vérifié par l'atelier sur chaque matériel
  quantifiable: boolean; // se compte à l'unité (tables, chaises…)
}

export interface Offre {
  id: string;
  titre: string; // ex. « Nettoyage »
  description: string;
  photo?: string; // identifiant de photo
  actif: boolean; // visible dans l'espace client
}

export interface Settings {
  nomLoueur: string;
  terme?: Terme; // comment le loueur appelle son matériel (module, machine, engin…)
  modelesPerso?: { id: string; nom: string; equipements: EquipementDef[] }[]; // modèles de listes créés par le loueur
  equipements: EquipementDef[];
  delaiReservesJours: number;
  avisGoogle: { actif: boolean; lien: string };
  offres: Offre[];
}

/** Événement libre du planning, créé à la main. Chaque loueur l'organise à sa façon : on choisit juste une couleur. */
export type RdvCouleur = "vert" | "turquoise" | "orange" | "indigo" | "rose" | "jaune" | "marron" | "gris";

export interface CalendarItem {
  id: string;
  titre: string;
  couleur: RdvCouleur;
  date: string; // AAAA-MM-JJ
  heureDebut?: string; // HH:MM
  heureFin?: string;
  lieu?: string;
  note?: string;
  contratId?: string;
  moduleId?: string;
  creeLe: string;
}

/** Commentaire laissé sur un événement du planning (livraison, retour, rendez-vous…). */
export interface EventComment {
  id: string;
  eventKey: string;
  auteur: string;
  texte: string;
  date: string;
}

export interface AppData {
  version: number;
  modules: Module[];
  contrats: Contract[];
  lignes: ContractLine[];
  demandes: ClientRequest[];
  historique: HistoryEvent[];
  rendezvous: CalendarItem[];
  commentaires: EventComment[];
  parametres: Settings;
}
