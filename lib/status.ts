import type { EquipementDef, LineStatus, ModuleStatus } from "./types";

export const MODULE_STATUS: Record<ModuleStatus, { label: string; tone: Tone }> = {
  disponible: { label: "Disponible", tone: "green" },
  reserve: { label: "Réservé", tone: "blue" },
  preparation: { label: "En préparation", tone: "blue" },
  pret: { label: "Prêt", tone: "indigo" },
  loue: { label: "Loué", tone: "slate" },
  retour_demande: { label: "Retour demandé", tone: "amber" },
  en_retour: { label: "En retour", tone: "amber" },
  a_remettre: { label: "À remettre en état", tone: "red" },
  reparation: { label: "En réparation", tone: "red" },
};

export const MODULE_STATUS_ORDER: ModuleStatus[] = [
  "disponible",
  "reserve",
  "preparation",
  "pret",
  "loue",
  "retour_demande",
  "en_retour",
  "a_remettre",
  "reparation",
];

export const LINE_STATUS: Record<LineStatus, { label: string; tone: Tone }> = {
  a_preparer: { label: "À préparer", tone: "amber" },
  en_preparation: { label: "En préparation", tone: "blue" },
  prete: { label: "Prête", tone: "indigo" },
  en_cours: { label: "En location", tone: "slate" },
  retour_demande: { label: "Retour demandé", tone: "amber" },
  retournee: { label: "Retournée", tone: "blue" },
  cloturee: { label: "Clôturée", tone: "green" },
};

export type Tone = "green" | "blue" | "indigo" | "slate" | "amber" | "red";

export const TONE_CLASSES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const EQUIPEMENTS_MODULAIRE: EquipementDef[] = [
  { nom: "Clés (2 jeux)", obligatoire: true, quantifiable: false },
  { nom: "Extincteur", obligatoire: true, quantifiable: false },
  { nom: "Éclairage fonctionnel", obligatoire: true, quantifiable: false },
  { nom: "Prises électriques", obligatoire: true, quantifiable: false },
  { nom: "Porte et serrure fonctionnelles", obligatoire: true, quantifiable: false },
  { nom: "Vitrages et volets intacts", obligatoire: true, quantifiable: false },
  { nom: "Sol et murs propres", obligatoire: true, quantifiable: false },
  { nom: "Climatiseur réversible", obligatoire: false, quantifiable: true },
  { nom: "Télécommande de climatisation", obligatoire: false, quantifiable: true },
  { nom: "Convecteur électrique", obligatoire: false, quantifiable: true },
  { nom: "Kitchenette", obligatoire: false, quantifiable: true },
  { nom: "Réfrigérateur", obligatoire: false, quantifiable: true },
  { nom: "Micro-ondes", obligatoire: false, quantifiable: true },
  { nom: "Chauffe-eau", obligatoire: false, quantifiable: true },
  { nom: "Table", obligatoire: false, quantifiable: true },
  { nom: "Chaise", obligatoire: false, quantifiable: true },
  { nom: "Bureau", obligatoire: false, quantifiable: true },
  { nom: "Armoire vestiaire", obligatoire: false, quantifiable: true },
  { nom: "Armoire de rangement", obligatoire: false, quantifiable: true },
  { nom: "Banc", obligatoire: false, quantifiable: true },
  { nom: "Patère", obligatoire: false, quantifiable: true },
  { nom: "Fenêtre intérieure", obligatoire: false, quantifiable: true },
];

const ctl = (nom: string): EquipementDef => ({ nom, obligatoire: true, quantifiable: false });
const opt = (nom: string): EquipementDef => ({ nom, obligatoire: false, quantifiable: true });

/** Modèles proposés dans les paramètres, à charger en un clic puis à ajuster. */
export const MODELES_METIER: { id: string; nom: string; equipements: EquipementDef[] }[] = [
  { id: "modulaire", nom: "Bâtiments modulaires et bases vie", equipements: EQUIPEMENTS_MODULAIRE },
  {
    id: "nacelles",
    nom: "Nacelles et levage",
    equipements: [
      ctl("VGP à jour (rapport présent)"),
      ctl("Niveau de carburant ou charge batterie"),
      ctl("Niveaux d'huile et hydraulique"),
      ctl("Pas de fuite visible"),
      ctl("Commandes et arrêt d'urgence fonctionnels"),
      ctl("Avertisseurs sonores et gyrophare"),
      ctl("Pneus ou chenilles en bon état"),
      ctl("Notice et clés présentes"),
      ctl("Propreté générale"),
      opt("Harnais"),
      opt("Longe"),
      opt("Chargeur de batterie"),
      opt("Patins de stabilisateurs"),
      opt("Rallonge électrique"),
    ],
  },
  {
    id: "tp",
    nom: "Engins de terrassement",
    equipements: [
      ctl("VGP à jour (rapport présent)"),
      ctl("Plein de carburant"),
      ctl("Niveaux d'huile, liquide de refroidissement et hydraulique"),
      ctl("Pas de fuite visible"),
      ctl("Graissage effectué"),
      ctl("Éclairage, gyrophare et alarme de recul"),
      ctl("Chenilles ou pneus en bon état"),
      ctl("Clés et notice présentes"),
      ctl("Propreté générale"),
      opt("Godet de curage"),
      opt("Godet de terrassement"),
      opt("Brise-roche"),
      opt("Attache rapide"),
      opt("Fourches"),
    ],
  },
];

/** Liste utilisée par les données créées avant les modèles (prototype pensé pour les modulaires). */
export const EQUIPEMENTS_HISTORIQUES = EQUIPEMENTS_MODULAIRE;

export const REQUEST_LABEL: Record<"sav" | "retour" | "reserve" | "devis", { label: string; tone: Tone }> = {
  sav: { label: "SAV", tone: "red" },
  retour: { label: "Demande de retour", tone: "amber" },
  reserve: { label: "Réserve à la réception", tone: "indigo" },
  devis: { label: "Demande de devis", tone: "green" },
};

export const DEFAULT_OFFRES: { id: string; titre: string; description: string; actif: boolean }[] = [];
