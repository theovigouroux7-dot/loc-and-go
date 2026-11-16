"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppData,
  ClientRequest,
  Constat,
  Contract,
  ContractLine,
  EventKind,
  HistoryEvent,
  InventaireCoche,
  Module,
  Reception,
  RequestType,
  Settings,
} from "./types";
import { DEFAULT_INVENTAIRE } from "./status";
import { formatDate, nowIso, normalizeNumero, today, uid } from "./utils";
import { clearPhotos } from "./photos";

const STORAGE_KEY = "loc-and-go:data:v1";
const DATA_VERSION = 1;

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    modules: [],
    contrats: [],
    lignes: [],
    demandes: [],
    historique: [],
    parametres: {
      nomLoueur: "Mon entreprise de location",
      inventaire: DEFAULT_INVENTAIRE,
      delaiReservesJours: 3,
    },
  };
}

// ---------------------------------------------------------------------------
// Entrées des actions
// ---------------------------------------------------------------------------

export interface ModuleInput {
  numero: string;
  type: string;
  dimensions: string;
  equipements: string;
  depot: string;
}

export interface ImportRow extends ModuleInput {
  contrat: string;
  client: string;
  ville: string;
  dateFin: string;
}

export interface ImportResult {
  modulesCrees: number;
  contratsCrees: number;
  modulesLoues: number;
}

export interface ContractInput {
  reference: string;
  client: string;
  adresse: string;
  ville: string;
  dateLivraison: string;
  dateFin: string;
  notes: string;
}

export interface LineRequest {
  type: string;
  quantite: number;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Transitions automatiques : une ligne prête dont la date de livraison est
// passée devient « en location » et le module passe « loué ».
// ---------------------------------------------------------------------------

function applyAutoTransitions(data: AppData): AppData {
  const day = today();
  let changed = false;
  const contrats = new Map(data.contrats.map((c) => [c.id, c]));
  const events: HistoryEvent[] = [];
  const modules = data.modules.map((m) => ({ ...m }));
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const lignes = data.lignes.map((l) => {
    if (l.statut !== "prete") return l;
    const contrat = contrats.get(l.contratId);
    const livraison = l.dateDebut || contrat?.dateLivraison || "";
    if (!livraison || livraison > day) return l;
    changed = true;
    const mod = l.moduleId ? moduleById.get(l.moduleId) : undefined;
    if (mod) {
      mod.statut = "loue";
      events.push(
        makeEvent("location", `Date de livraison passée : module loué (contrat ${contrat?.reference ?? ""})`, {
          moduleId: mod.id,
          contratId: l.contratId,
        }),
      );
    }
    return { ...l, statut: "en_cours" as const };
  });

  if (!changed) return data;
  return { ...data, lignes, modules, historique: [...events, ...data.historique] };
}

function makeEvent(kind: EventKind, message: string, refs: { moduleId?: string; contratId?: string } = {}): HistoryEvent {
  return { id: uid("ev"), date: nowIso(), kind, message, ...refs };
}

// ---------------------------------------------------------------------------
// Contexte
// ---------------------------------------------------------------------------

interface StoreValue {
  data: AppData;
  ready: boolean;
  // Parc
  addModule: (input: ModuleInput) => ActionResult;
  updateModule: (id: string, patch: Partial<ModuleInput>) => ActionResult;
  deleteModule: (id: string) => ActionResult;
  importRows: (rows: ImportRow[]) => ImportResult;
  // Contrats
  createContract: (input: ContractInput, lignes: LineRequest[]) => string;
  updateContract: (id: string, patch: Partial<ContractInput>) => void;
  addLines: (contratId: string, lignes: LineRequest[]) => void;
  setLineDateFin: (lineId: string, dateFin: string) => void;
  setContractDateFin: (contratId: string, dateFin: string) => void;
  // Atelier
  assignModule: (lineId: string, moduleId: string) => ActionResult;
  unassignModule: (lineId: string) => void;
  updatePreparation: (lineId: string, patch: { photos?: string[]; inventaire?: InventaireCoche }) => void;
  validatePreparation: (lineId: string) => ActionResult;
  registerReturn: (moduleId: string) => ActionResult;
  saveConstat: (lineId: string, constat: Omit<Constat, "faitLe">) => void;
  startRepair: (moduleId: string) => void;
  finishRepair: (moduleId: string) => void;
  // Client
  signReception: (lineId: string, reception: Omit<Reception, "signeeLe">) => void;
  createRequest: (input: {
    type: RequestType;
    moduleId: string;
    message: string;
    dateSouhaitee?: string;
    photos: string[];
  }) => ActionResult;
  setRequestHandled: (id: string, traitee: boolean) => void;
  // Divers
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => Promise<void>;
  replaceAll: (data: AppData) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Chargement initial depuis le navigateur.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppData;
        const base = emptyData();
        setData(
          applyAutoTransitions({
            ...base,
            ...parsed,
            parametres: { ...base.parametres, ...parsed.parametres },
          }),
        );
      }
    } catch (err) {
      console.error("Données locales illisibles, démarrage à vide", err);
    }
    setReady(true);
  }, []);

  // Sauvegarde à chaque modification.
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Sauvegarde impossible", err);
    }
  }, [data, ready]);

  // Synchronisation entre onglets (ex. vue client ouverte dans un autre onglet).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setData(JSON.parse(e.newValue) as AppData);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Vérifie les dates de livraison toutes les minutes.
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => setData((d) => applyAutoTransitions(d)), 60_000);
    return () => window.clearInterval(timer);
  }, [ready]);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((d) => applyAutoTransitions(fn(d)));
  }, []);

  // --- Parc -----------------------------------------------------------------

  const addModule = useCallback(
    (input: ModuleInput): ActionResult => {
      const numero = input.numero.trim();
      if (!numero) return { ok: false, error: "Le numéro de module est obligatoire." };
      const exists = dataRef.current.modules.some((m) => normalizeNumero(m.numero) === normalizeNumero(numero));
      if (exists) return { ok: false, error: `Le module ${numero} existe déjà dans le parc.` };
      const mod: Module = {
        id: uid("mod"),
        numero,
        type: input.type.trim(),
        dimensions: input.dimensions.trim(),
        equipements: input.equipements.trim(),
        depot: input.depot.trim(),
        statut: "disponible",
        ligneId: null,
        creeLe: nowIso(),
      };
      update((d) => ({
        ...d,
        modules: [...d.modules, mod],
        historique: [makeEvent("ajout", `Module ${numero} ajouté au parc`, { moduleId: mod.id }), ...d.historique],
      }));
      return { ok: true };
    },
    [update],
  );

  const updateModule = useCallback(
    (id: string, patch: Partial<ModuleInput>): ActionResult => {
      if (patch.numero !== undefined) {
        const numero = patch.numero.trim();
        if (!numero) return { ok: false, error: "Le numéro de module est obligatoire." };
        const clash = dataRef.current.modules.some(
          (m) => m.id !== id && normalizeNumero(m.numero) === normalizeNumero(numero),
        );
        if (clash) return { ok: false, error: `Le numéro ${numero} est déjà utilisé.` };
      }
      update((d) => ({
        ...d,
        modules: d.modules.map((m) =>
          m.id === id
            ? {
                ...m,
                ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])),
              }
            : m,
        ),
        historique: [makeEvent("modification", "Fiche du module modifiée", { moduleId: id }), ...d.historique],
      }));
      return { ok: true };
    },
    [update],
  );

  const deleteModule = useCallback(
    (id: string): ActionResult => {
      const mod = dataRef.current.modules.find((m) => m.id === id);
      if (!mod) return { ok: false, error: "Module introuvable." };
      if (mod.statut !== "disponible" || mod.ligneId) {
        return { ok: false, error: "Seul un module disponible, hors contrat, peut être supprimé." };
      }
      update((d) => ({ ...d, modules: d.modules.filter((m) => m.id !== id) }));
      return { ok: true };
    },
    [update],
  );

  const importRows = useCallback(
    (rows: ImportRow[]): ImportResult => {
      const result: ImportResult = { modulesCrees: 0, contratsCrees: 0, modulesLoues: 0 };
      // Calcul synchrone à partir de l'état courant, pour pouvoir renvoyer le bilan.
      const compute = (d: AppData): AppData => {
        const modules = [...d.modules];
        const contrats = [...d.contrats];
        const lignes = [...d.lignes];
        const events: HistoryEvent[] = [];
        const known = new Set(modules.map((m) => normalizeNumero(m.numero)));
        const contratByRef = new Map(contrats.map((c) => [normalizeNumero(c.reference), c]));

        for (const row of rows) {
          const numero = row.numero.trim();
          if (!numero || known.has(normalizeNumero(numero))) continue;
          known.add(normalizeNumero(numero));
          const mod: Module = {
            id: uid("mod"),
            numero,
            type: row.type.trim(),
            dimensions: row.dimensions.trim(),
            equipements: row.equipements.trim(),
            depot: row.depot.trim(),
            statut: "disponible",
            ligneId: null,
            creeLe: nowIso(),
          };

          const ref = row.contrat.trim();
          if (ref) {
            let contrat = contratByRef.get(normalizeNumero(ref));
            if (!contrat) {
              contrat = {
                id: uid("ctr"),
                reference: ref,
                client: row.client.trim(),
                adresse: "",
                ville: row.ville.trim(),
                dateLivraison: "",
                dateFin: row.dateFin,
                notes: "Contrat repris lors de l'import du parc.",
                importe: true,
                creeLe: nowIso(),
              };
              contrats.push(contrat);
              contratByRef.set(normalizeNumero(ref), contrat);
              result.contratsCrees += 1;
            }
            const ligne: ContractLine = {
              id: uid("lig"),
              contratId: contrat.id,
              typeDemande: mod.type,
              moduleId: mod.id,
              dateDebut: "",
              dateFin: row.dateFin || contrat.dateFin,
              statut: "en_cours",
            };
            lignes.push(ligne);
            mod.statut = "loue";
            mod.ligneId = ligne.id;
            result.modulesLoues += 1;
          }
          modules.push(mod);
          result.modulesCrees += 1;
        }

        events.push(
          makeEvent(
            "import",
            result.modulesLoues > 0
              ? `Import : ${result.modulesCrees} module(s), dont ${result.modulesLoues} déjà en location (${result.contratsCrees} contrat(s) repris)`
              : `Import : ${result.modulesCrees} module(s) intégré(s) au parc`,
          ),
        );
        return { ...d, modules, contrats, lignes, historique: [...events, ...d.historique] };
      };
      const next = applyAutoTransitions(compute(dataRef.current));
      dataRef.current = next;
      setData(next);
      return result;
    },
    [],
  );

  // --- Contrats -------------------------------------------------------------

  const buildLines = (contrat: Contract, demandes: LineRequest[]): ContractLine[] =>
    demandes.flatMap((req) =>
      Array.from({ length: Math.max(0, Math.floor(req.quantite)) }, () => ({
        id: uid("lig"),
        contratId: contrat.id,
        typeDemande: req.type.trim(),
        moduleId: null,
        dateDebut: contrat.dateLivraison,
        dateFin: contrat.dateFin,
        statut: "a_preparer" as const,
      })),
    );

  const createContract = useCallback(
    (input: ContractInput, demandes: LineRequest[]): string => {
      const contrat: Contract = {
        id: uid("ctr"),
        reference: input.reference.trim(),
        client: input.client.trim(),
        adresse: input.adresse.trim(),
        ville: input.ville.trim(),
        dateLivraison: input.dateLivraison,
        dateFin: input.dateFin,
        notes: input.notes.trim(),
        importe: false,
        creeLe: nowIso(),
      };
      const nouvelles = buildLines(contrat, demandes);
      update((d) => ({
        ...d,
        contrats: [...d.contrats, contrat],
        lignes: [...d.lignes, ...nouvelles],
        historique: [
          makeEvent("contrat", `Contrat ${contrat.reference} enregistré : ${nouvelles.length} module(s) à préparer`, {
            contratId: contrat.id,
          }),
          ...d.historique,
        ],
      }));
      return contrat.id;
    },
    [update],
  );

  const updateContract = useCallback(
    (id: string, patch: Partial<ContractInput>) => {
      update((d) => {
        const contrats = d.contrats.map((c) => (c.id === id ? { ...c, ...patch } : c));
        // La date de livraison s'applique aux lignes qui ne sont pas encore parties.
        const lignes =
          patch.dateLivraison !== undefined
            ? d.lignes.map((l) =>
                l.contratId === id && ["a_preparer", "en_preparation", "prete"].includes(l.statut)
                  ? { ...l, dateDebut: patch.dateLivraison as string }
                  : l,
              )
            : d.lignes;
        return {
          ...d,
          contrats,
          lignes,
          historique: [makeEvent("modification", "Contrat modifié", { contratId: id }), ...d.historique],
        };
      });
    },
    [update],
  );

  const addLines = useCallback(
    (contratId: string, demandes: LineRequest[]) => {
      update((d) => {
        const contrat = d.contrats.find((c) => c.id === contratId);
        if (!contrat) return d;
        const nouvelles = buildLines(contrat, demandes);
        return {
          ...d,
          lignes: [...d.lignes, ...nouvelles],
          historique: [
            makeEvent("contrat", `${nouvelles.length} module(s) ajouté(s) au contrat ${contrat.reference}`, { contratId }),
            ...d.historique,
          ],
        };
      });
    },
    [update],
  );

  const setLineDateFin = useCallback(
    (lineId: string, dateFin: string) => {
      update((d) => ({
        ...d,
        lignes: d.lignes.map((l) => (l.id === lineId ? { ...l, dateFin } : l)),
      }));
    },
    [update],
  );

  const setContractDateFin = useCallback(
    (contratId: string, dateFin: string) => {
      update((d) => ({
        ...d,
        contrats: d.contrats.map((c) => (c.id === contratId ? { ...c, dateFin } : c)),
        lignes: d.lignes.map((l) =>
          l.contratId === contratId && l.statut !== "cloturee" && l.statut !== "retournee" ? { ...l, dateFin } : l,
        ),
        historique: [makeEvent("modification", `Fin de contrat portée au ${formatDate(dateFin)}`, { contratId }), ...d.historique],
      }));
    },
    [update],
  );

  // --- Atelier --------------------------------------------------------------

  const assignModule = useCallback(
    (lineId: string, moduleId: string): ActionResult => {
      const d = dataRef.current;
      const ligne = d.lignes.find((l) => l.id === lineId);
      const mod = d.modules.find((m) => m.id === moduleId);
      if (!ligne) return { ok: false, error: "Ligne de contrat introuvable." };
      if (!mod) return { ok: false, error: "Module introuvable dans le parc." };
      if (mod.statut !== "disponible") {
        return { ok: false, error: `Le module ${mod.numero} n'est pas disponible (il est ${statutLabel(mod.statut)}).` };
      }
      if (ligne.moduleId) return { ok: false, error: "Un module est déjà lié à cette ligne." };
      const contrat = d.contrats.find((c) => c.id === ligne.contratId);
      update((s) => ({
        ...s,
        lignes: s.lignes.map((l) =>
          l.id === lineId
            ? { ...l, moduleId, statut: "en_preparation", preparation: { photos: [], inventaire: {} } }
            : l,
        ),
        modules: s.modules.map((m) => (m.id === moduleId ? { ...m, statut: "reserve", ligneId: lineId } : m)),
        historique: [
          makeEvent("affectation", `Lié au contrat ${contrat?.reference ?? ""}`, { moduleId, contratId: ligne.contratId }),
          ...s.historique,
        ],
      }));
      return { ok: true };
    },
    [update],
  );

  const unassignModule = useCallback(
    (lineId: string) => {
      update((s) => {
        const ligne = s.lignes.find((l) => l.id === lineId);
        if (!ligne?.moduleId) return s;
        const moduleId = ligne.moduleId;
        return {
          ...s,
          lignes: s.lignes.map((l) =>
            l.id === lineId ? { ...l, moduleId: null, statut: "a_preparer", preparation: undefined } : l,
          ),
          modules: s.modules.map((m) => (m.id === moduleId ? { ...m, statut: "disponible", ligneId: null } : m)),
          historique: [
            makeEvent("modification", "Module détaché du contrat, remis disponible", {
              moduleId,
              contratId: ligne.contratId,
            }),
            ...s.historique,
          ],
        };
      });
    },
    [update],
  );

  const updatePreparation = useCallback(
    (lineId: string, patch: { photos?: string[]; inventaire?: InventaireCoche }) => {
      update((s) => {
        const ligne = s.lignes.find((l) => l.id === lineId);
        if (!ligne) return s;
        const preparation = { photos: [], inventaire: {}, ...ligne.preparation, ...patch };
        return {
          ...s,
          lignes: s.lignes.map((l) => (l.id === lineId ? { ...l, preparation } : l)),
          modules: s.modules.map((m) =>
            m.id === ligne.moduleId && m.statut === "reserve" ? { ...m, statut: "preparation" } : m,
          ),
        };
      });
    },
    [update],
  );

  const validatePreparation = useCallback(
    (lineId: string): ActionResult => {
      const d = dataRef.current;
      const ligne = d.lignes.find((l) => l.id === lineId);
      if (!ligne?.moduleId || !ligne.preparation) return { ok: false, error: "Aucun module lié à cette ligne." };
      const manquants = d.parametres.inventaire.filter((item) => !ligne.preparation?.inventaire[item]);
      if (manquants.length > 0) {
        return { ok: false, error: `Inventaire incomplet : ${manquants.length} élément(s) non coché(s).` };
      }
      if (ligne.preparation.photos.length === 0) {
        return { ok: false, error: "Ajoutez au moins une photo du module avant de valider." };
      }
      const moduleId = ligne.moduleId;
      update((s) => ({
        ...s,
        lignes: s.lignes.map((l) =>
          l.id === lineId
            ? { ...l, statut: "prete", preparation: { ...l.preparation!, valideeLe: nowIso() } }
            : l,
        ),
        modules: s.modules.map((m) => (m.id === moduleId ? { ...m, statut: "pret" } : m)),
        historique: [
          makeEvent("preparation", `Préparation validée (${ligne.preparation!.photos.length} photo(s), inventaire complet)`, {
            moduleId,
            contratId: ligne.contratId,
          }),
          ...s.historique,
        ],
      }));
      return { ok: true };
    },
    [update],
  );

  const registerReturn = useCallback(
    (moduleId: string): ActionResult => {
      const d = dataRef.current;
      const mod = d.modules.find((m) => m.id === moduleId);
      if (!mod) return { ok: false, error: "Module introuvable." };
      if (mod.statut !== "loue" && mod.statut !== "retour_demande") {
        return { ok: false, error: `Le module ${mod.numero} n'est pas en location (il est ${statutLabel(mod.statut)}).` };
      }
      const ligne = d.lignes.find((l) => l.id === mod.ligneId);
      update((s) => ({
        ...s,
        modules: s.modules.map((m) => (m.id === moduleId ? { ...m, statut: "en_retour" } : m)),
        lignes: s.lignes.map((l) => (l.id === mod.ligneId ? { ...l, statut: "retournee" } : l)),
        historique: [
          makeEvent("retour", "Retour au parc enregistré par l'atelier", { moduleId, contratId: ligne?.contratId }),
          ...s.historique,
        ],
      }));
      return { ok: true };
    },
    [update],
  );

  const saveConstat = useCallback(
    (lineId: string, input: Omit<Constat, "faitLe">) => {
      update((s) => {
        const ligne = s.lignes.find((l) => l.id === lineId);
        if (!ligne?.moduleId) return s;
        const moduleId = ligne.moduleId;
        const constat: Constat = { ...input, faitLe: nowIso() };
        const manquants = Object.entries(input.inventaire).filter(([, present]) => !present).length;
        const message = input.intact
          ? "Constat de retour : module intact, remis disponible"
          : `Constat de retour : dégâts constatés${manquants ? `, ${manquants} élément(s) manquant(s)` : ""}`;
        return {
          ...s,
          lignes: s.lignes.map((l) => (l.id === lineId ? { ...l, statut: "cloturee", constat } : l)),
          modules: s.modules.map((m) =>
            m.id === moduleId ? { ...m, statut: input.intact ? "disponible" : "a_remettre", ligneId: null } : m,
          ),
          historique: [makeEvent("constat", message, { moduleId, contratId: ligne.contratId }), ...s.historique],
        };
      });
    },
    [update],
  );

  const startRepair = useCallback(
    (moduleId: string) => {
      update((s) => ({
        ...s,
        modules: s.modules.map((m) => (m.id === moduleId && m.statut === "a_remettre" ? { ...m, statut: "reparation" } : m)),
        historique: [makeEvent("reparation", "Réparation démarrée", { moduleId }), ...s.historique],
      }));
    },
    [update],
  );

  const finishRepair = useCallback(
    (moduleId: string) => {
      update((s) => ({
        ...s,
        modules: s.modules.map((m) =>
          m.id === moduleId && (m.statut === "reparation" || m.statut === "a_remettre")
            ? { ...m, statut: "disponible", ligneId: null }
            : m,
        ),
        historique: [makeEvent("disponible", "Réparation validée par l'atelier : module disponible", { moduleId }), ...s.historique],
      }));
    },
    [update],
  );

  // --- Client ---------------------------------------------------------------

  const signReception = useCallback(
    (lineId: string, input: Omit<Reception, "signeeLe">) => {
      update((s) => {
        const ligne = s.lignes.find((l) => l.id === lineId);
        if (!ligne) return s;
        const reserves = input.reserves.trim();
        return {
          ...s,
          lignes: s.lignes.map((l) => (l.id === lineId ? { ...l, reception: { ...input, signeeLe: nowIso() } } : l)),
          historique: [
            makeEvent(
              "reception",
              `Réception signée par ${input.nom}${reserves ? " avec réserves" : " sans réserve"}`,
              { moduleId: ligne.moduleId ?? undefined, contratId: ligne.contratId },
            ),
            ...s.historique,
          ],
        };
      });
    },
    [update],
  );

  const createRequest = useCallback(
    (input: { type: RequestType; moduleId: string; message: string; dateSouhaitee?: string; photos: string[] }): ActionResult => {
      const mod = dataRef.current.modules.find((m) => m.id === input.moduleId);
      if (!mod?.ligneId) return { ok: false, error: "Ce module n'est rattaché à aucun contrat en cours." };
      const ligne = dataRef.current.lignes.find((l) => l.id === mod.ligneId);
      if (!ligne) return { ok: false, error: "Contrat introuvable." };
      if (input.type === "retour" && mod.statut !== "loue") {
        return { ok: false, error: "Un retour ne peut être demandé que pour un module en location." };
      }
      const demande: ClientRequest = {
        id: uid("dem"),
        type: input.type,
        moduleId: mod.id,
        ligneId: ligne.id,
        message: input.message.trim(),
        dateSouhaitee: input.dateSouhaitee,
        photos: input.photos,
        creeeLe: nowIso(),
        traitee: false,
      };
      update((s) => ({
        ...s,
        demandes: [demande, ...s.demandes],
        modules:
          input.type === "retour"
            ? s.modules.map((m) => (m.id === mod.id ? { ...m, statut: "retour_demande" } : m))
            : s.modules,
        lignes:
          input.type === "retour"
            ? s.lignes.map((l) =>
                l.id === ligne.id ? { ...l, statut: "retour_demande", dateRetourSouhaitee: input.dateSouhaitee } : l,
              )
            : s.lignes,
        historique: [
          makeEvent(
            input.type === "retour" ? "retour_demande" : "sav",
            input.type === "retour"
              ? `Retour demandé pour le ${formatDate(input.dateSouhaitee)}`
              : `Demande de SAV : ${demande.message || "sans détail"}`,
            { moduleId: mod.id, contratId: ligne.contratId },
          ),
          ...s.historique,
        ],
      }));
      return { ok: true };
    },
    [update],
  );

  const setRequestHandled = useCallback(
    (id: string, traitee: boolean) => {
      update((s) => ({ ...s, demandes: s.demandes.map((r) => (r.id === id ? { ...r, traitee } : r)) }));
    },
    [update],
  );

  // --- Divers ---------------------------------------------------------------

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => update((s) => ({ ...s, parametres: { ...s.parametres, ...patch } })),
    [update],
  );

  const resetAll = useCallback(async () => {
    await clearPhotos();
    setData(emptyData());
  }, []);

  const replaceAll = useCallback((next: AppData) => {
    const base = emptyData();
    setData(applyAutoTransitions({ ...base, ...next, parametres: { ...base.parametres, ...next.parametres } }));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      ready,
      addModule,
      updateModule,
      deleteModule,
      importRows,
      createContract,
      updateContract,
      addLines,
      setLineDateFin,
      setContractDateFin,
      assignModule,
      unassignModule,
      updatePreparation,
      validatePreparation,
      registerReturn,
      saveConstat,
      startRepair,
      finishRepair,
      signReception,
      createRequest,
      setRequestHandled,
      updateSettings,
      resetAll,
      replaceAll,
    }),
    [
      data,
      ready,
      addModule,
      updateModule,
      deleteModule,
      importRows,
      createContract,
      updateContract,
      addLines,
      setLineDateFin,
      setContractDateFin,
      assignModule,
      unassignModule,
      updatePreparation,
      validatePreparation,
      registerReturn,
      saveConstat,
      startRepair,
      finishRepair,
      signReception,
      createRequest,
      setRequestHandled,
      updateSettings,
      resetAll,
      replaceAll,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return ctx;
}

function statutLabel(statut: Module["statut"]): string {
  const labels: Record<Module["statut"], string> = {
    disponible: "disponible",
    reserve: "réservé",
    preparation: "en préparation",
    pret: "prêt",
    loue: "loué",
    retour_demande: "en attente de retour",
    en_retour: "en retour",
    a_remettre: "à remettre en état",
    reparation: "en réparation",
  };
  return labels[statut];
}

// ---------------------------------------------------------------------------
// Sélecteurs utiles
// ---------------------------------------------------------------------------

export function findModuleByNumero(data: AppData, numero: string): Module | undefined {
  const n = normalizeNumero(numero);
  return data.modules.find((m) => normalizeNumero(m.numero) === n);
}

export function lineOfModule(data: AppData, mod: Module | undefined): ContractLine | undefined {
  if (!mod?.ligneId) return undefined;
  return data.lignes.find((l) => l.id === mod.ligneId);
}

export function contractOf(data: AppData, ligne: ContractLine | undefined): Contract | undefined {
  if (!ligne) return undefined;
  return data.contrats.find((c) => c.id === ligne.contratId);
}

/** Dernière ligne clôturée ou retournée d'un module (pour le constat). */
export function lastLineOfModule(data: AppData, moduleId: string): ContractLine | undefined {
  const lignes = data.lignes.filter((l) => l.moduleId === moduleId);
  return lignes[lignes.length - 1];
}
