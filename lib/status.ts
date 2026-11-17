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

export const DEFAULT_EQUIPEMENTS: EquipementDef[] = [
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

export const REQUEST_LABEL: Record<"sav" | "retour" | "reserve", { label: string; tone: Tone }> = {
  sav: { label: "SAV", tone: "red" },
  retour: { label: "Retour", tone: "amber" },
  reserve: { label: "Réserve à la réception", tone: "indigo" },
};
