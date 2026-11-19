"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppData,
  ContractAccessoire,
  ContractDocument,
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
import { DEFAULT_EQUIPEMENTS, DEFAULT_OFFRES } from "./status";
import { formatDate, nowIso, normalizeNumero, today, uid } from "./utils";
import { clearPhotos } from "./photos";
import { migrate, obligatoires } from "./inventory";
import { applyRecords, deleteAllRecords, diffData, fetchRecords, remoteEnabled, sortData, upsertRecords, type RecordRow } from "./remote";

const STORAGE_KEY = "loc-and-go:data:v1";
const DATA_VERSION = 3;
const POLL_MS = 5_000;

export type SyncStatus = "local" | "ok" | "saving" | "error";

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
      equipements: DEFAULT_EQUIPEMENTS,
      avisGoogle: { actif: false, lien: "" },
      offres: DEFAULT_OFFRES,
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
  documents?: ContractDocument[];
  accessoires?: ContractAccessoire[];
}

export interface LineRequest {
  type: string;
  quantite: number;
  designation?: string;
  /** Équipements du groupe, en quantités totales comme sur le contrat (ex. 4 tables pour 2 modules). */
  equipements?: Record<string, number>;
  /** Numéros de modules précis indiqués sur le contrat, le cas échéant. */
  numeros?: string[];
}

/** Répartit des quantités totales entre n modules (les premiers reçoivent le reste). */
export function repartir(totaux: Record<string, number> | undefined, n: number): Record<string, number>[] {
  const out = Array.from({ length: n }, () => ({}) as Record<string, number>);
  if (!totaux || n === 0) return out;
  for (const [nom, total] of Object.entries(totaux)) {
    const t = Math.max(0, Math.floor(total));
    const base = Math.floor(t / n);
    const reste = t % n;
    out.forEach((o, i) => {
      const q = base + (i < reste ? 1 : 0);
      if (q > 0) o[nom] = q;
    });
  }
  return out;
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
  syncStatus: SyncStatus;
  syncError: string;
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
  setDeliveryDate: (contratId: string, ancienne: string, nouvelle: string) => void;
  setAccessoirePret: (contratId: string, accessoireId: string, pret: boolean) => void;
  setReturnDate: (contratId: string, ancienne: string, nouvelle: string) => void;
  // Atelier
  assignModule: (lineId: string, moduleId: string) => ActionResult;
  unassignModule: (lineId: string) => void;
  updatePreparation: (lineId: string, patch: { photos?: string[]; inventaire?: InventaireCoche; equipements?: Record<string, number> }) => void;
  validatePreparation: (lineId: string, signature: { technicien: string; signature: string }) => ActionResult;
  registerReturn: (moduleId: string) => ActionResult;
  saveConstat: (lineId: string, constat: Omit<Constat, "faitLe">) => void;
  startRepair: (moduleId: string) => void;
  finishRepair: (moduleId: string) => void;
  // Client
  signReceptions: (
    lineIds: string[],
    input: { inventaires: Record<string, InventaireCoche>; reserves: string; photos: string[]; nom: string; signature: string },
  ) => void;
  createRequest: (input: {
    type: RequestType;
    moduleId: string;
    message: string;
    dateSouhaitee?: string;
    photos: string[];
    offreId?: string;
    offreTitre?: string;
    contact?: string;
  }) => ActionResult;
  requestReturn: (moduleIds: string[], dateSouhaitee: string, message: string) => ActionResult;
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(remoteEnabled ? "ok" : "local");
  const [syncError, setSyncError] = useState("");
  const dataRef = useRef(data);
  dataRef.current = data;

  // Synchronisation en ligne : dernier état connu de la base, envois en cours, curseur de lecture.
  const syncedRef = useRef<AppData>(data);
  const pendingRef = useRef(0);
  const lastLocalChangeRef = useRef(0);
  const cursorRef = useRef<string | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const normalize = (raw: AppData): AppData => {
    const base = emptyData();
    return sortData(migrate({ ...base, ...raw, parametres: { ...base.parametres, ...raw.parametres } } as Parameters<typeof migrate>[0]));
  };

  const advanceCursor = (rows: RecordRow[]) => {
    for (const r of rows) if (r.updated_at && (!cursorRef.current || r.updated_at > cursorRef.current)) cursorRef.current = r.updated_at;
  };

  // Chargement initial : base en ligne si elle est configurée, sinon navigateur.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (remoteEnabled) {
        try {
          const rows = await fetchRecords();
          if (cancelled) return;
          advanceCursor(rows);
          const loaded = normalize(applyRecords(emptyData(), rows));
          syncedRef.current = loaded;
          setData(applyAutoTransitions(loaded));
        } catch (err) {
          console.error(err);
          setSyncStatus("error");
          setSyncError(err instanceof Error ? err.message : String(err));
        }
      } else {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) setData(applyAutoTransitions(normalize(JSON.parse(raw) as AppData)));
        } catch (err) {
          console.error("Données locales illisibles, démarrage à vide", err);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Enregistrement à chaque modification.
  useEffect(() => {
    if (!ready) return;
    if (!remoteEnabled) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.error("Sauvegarde impossible", err);
      }
      return;
    }
    const rows = diffData(syncedRef.current, data);
    syncedRef.current = data;
    if (rows.length === 0) return;
    lastLocalChangeRef.current = Date.now();
    pendingRef.current += 1;
    setSyncStatus("saving");
    queueRef.current = queueRef.current
      .then(() => upsertRecords(rows))
      .then(() => {
        setSyncError("");
      })
      .catch((err) => {
        console.error(err);
        setSyncError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        pendingRef.current -= 1;
        if (pendingRef.current === 0) setSyncStatus((s) => (s === "saving" ? "ok" : s));
      });
  }, [data, ready]);

  useEffect(() => {
    if (syncError) setSyncStatus("error");
  }, [syncError]);

  // Récupère les modifications faites sur les autres appareils.
  useEffect(() => {
    if (!ready || !remoteEnabled) return;
    let running = false;
    const pull = async () => {
      if (running || pendingRef.current > 0 || Date.now() - lastLocalChangeRef.current < 2_000) return;
      running = true;
      try {
        // Petite marge en arrière pour ne rien manquer d'une écriture concurrente.
        const since = cursorRef.current ? new Date(Date.parse(cursorRef.current) - 10_000).toISOString() : undefined;
        const rows = await fetchRecords(since);
        if (rows.length === 0 || pendingRef.current > 0 || Date.now() - lastLocalChangeRef.current < 2_000) return;
        advanceCursor(rows);
        const merged = normalize(applyRecords(dataRef.current, rows));
        if (JSON.stringify(merged) === JSON.stringify(dataRef.current)) return;
        syncedRef.current = merged;
        dataRef.current = merged;
        setData(applyAutoTransitions(merged));
        setSyncError("");
        setSyncStatus("ok");
      } catch (err) {
        console.error(err);
      } finally {
        running = false;
      }
    };
    const timer = window.setInterval(pull, POLL_MS);
    const onFocus = () => pull();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready]);

  // Synchronisation entre onglets en mode local (ex. vue client ouverte dans un autre onglet).
  useEffect(() => {
    if (remoteEnabled) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setData(normalize(JSON.parse(e.newValue) as AppData));
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
              creeLe: nowIso(),
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
    demandes.flatMap((req) => {
      const n = Math.max(0, Math.floor(req.quantite));
      const parts = repartir(req.equipements, n);
      return Array.from({ length: n }, (_, i) => ({
        id: uid("lig"),
        contratId: contrat.id,
        typeDemande: req.type.trim(),
        designation: req.designation?.trim() || undefined,
        numeroPrevu: req.numeros?.[i]?.trim() || undefined,
        equipementsPrevus: parts[i],
        moduleId: null,
        dateDebut: contrat.dateLivraison,
        dateFin: contrat.dateFin,
        statut: "a_preparer" as const,
        creeLe: nowIso(),
      }));
    });

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
        documents: input.documents ?? [],
        accessoires: (input.accessoires ?? []).filter((a) => a.nom.trim() && a.quantite > 0),
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

  const setDeliveryDate = useCallback(
    (contratId: string, ancienne: string, nouvelle: string) => {
      if (!nouvelle || nouvelle === ancienne) return;
      update((s) => ({
        ...s,
        contrats: s.contrats.map((c) => (c.id === contratId && c.dateLivraison === ancienne ? { ...c, dateLivraison: nouvelle } : c)),
        lignes: s.lignes.map((l) =>
          l.contratId === contratId && l.dateDebut === ancienne && ["a_preparer", "en_preparation", "prete"].includes(l.statut)
            ? { ...l, dateDebut: nouvelle }
            : l,
        ),
        historique: [
          makeEvent("modification", `Livraison déplacée du ${formatDate(ancienne)} au ${formatDate(nouvelle)}`, { contratId }),
          ...s.historique,
        ],
      }));
    },
    [update],
  );

  const setAccessoirePret = useCallback(
    (contratId: string, accessoireId: string, pret: boolean) => {
      update((s) => {
        const contrat = s.contrats.find((c) => c.id === contratId);
        const acc = contrat?.accessoires?.find((a) => a.id === accessoireId);
        if (!contrat || !acc) return s;
        return {
          ...s,
          contrats: s.contrats.map((c) =>
            c.id === contratId
              ? {
                  ...c,
                  accessoires: (c.accessoires ?? []).map((a) =>
                    a.id === accessoireId ? { ...a, pret, prepareLe: pret ? nowIso() : undefined } : a,
                  ),
                }
              : c,
          ),
          historique: [
            makeEvent("preparation", `${acc.quantite} × ${acc.nom} : ${pret ? "prêt(s) au départ" : "remis à préparer"}`, { contratId }),
            ...s.historique,
          ],
        };
      });
    },
    [update],
  );

  const setReturnDate = useCallback(
    (contratId: string, ancienne: string, nouvelle: string) => {
      if (!nouvelle || nouvelle === ancienne) return;
      update((s) => {
        const concernees = new Set(
          s.lignes.filter((l) => l.contratId === contratId && l.statut === "retour_demande" && l.dateRetourSouhaitee === ancienne).map((l) => l.id),
        );
        return {
          ...s,
          lignes: s.lignes.map((l) => (concernees.has(l.id) ? { ...l, dateRetourSouhaitee: nouvelle } : l)),
          demandes: s.demandes.map((d) =>
            d.type === "retour" && (concernees.has(d.ligneId) || d.ligneIds?.some((id) => concernees.has(id))) && d.dateSouhaitee === ancienne
              ? { ...d, dateSouhaitee: nouvelle }
              : d,
          ),
          historique: [
            makeEvent("modification", `Retour déplacé du ${formatDate(ancienne)} au ${formatDate(nouvelle)}`, { contratId }),
            ...s.historique,
          ],
        };
      });
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
            ? { ...l, moduleId, statut: "en_preparation", preparation: { photos: [], inventaire: {}, equipements: { ...(l.equipementsPrevus ?? {}) } } }
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
    (lineId: string, patch: { photos?: string[]; inventaire?: InventaireCoche; equipements?: Record<string, number> }) => {
      update((s) => {
        const ligne = s.lignes.find((l) => l.id === lineId);
        if (!ligne) return s;
        const preparation = { photos: [], inventaire: {}, equipements: {}, ...ligne.preparation, ...patch };
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
    (lineId: string, sign: { technicien: string; signature: string }): ActionResult => {
      const d = dataRef.current;
      const ligne = d.lignes.find((l) => l.id === lineId);
      if (!ligne?.moduleId || !ligne.preparation) return { ok: false, error: "Aucun module lié à cette ligne." };
      if (!sign.technicien.trim()) return { ok: false, error: "Indiquez le nom de la personne qui a fait l'inventaire." };
      if (!sign.signature) return { ok: false, error: "La personne qui a fait l'inventaire doit signer." };
      const manquants = obligatoires(d.parametres).filter((e) => !ligne.preparation?.inventaire[e.nom]);
      if (manquants.length > 0) {
        return { ok: false, error: `Équipements obligatoires non vérifiés : ${manquants.map((e) => e.nom).join(", ")}.` };
      }
      if (ligne.preparation.photos.length === 0) {
        return { ok: false, error: "Ajoutez au moins une photo du module avant de valider." };
      }
      const moduleId = ligne.moduleId;
      update((s) => ({
        ...s,
        lignes: s.lignes.map((l) =>
          l.id === lineId
            ? {
                ...l,
                statut: "prete",
                preparation: { ...l.preparation!, valideeLe: nowIso(), technicien: sign.technicien.trim(), signatureTechnicien: sign.signature },
              }
            : l,
        ),
        modules: s.modules.map((m) => (m.id === moduleId ? { ...m, statut: "pret" } : m)),
        historique: [
          makeEvent("preparation", `Préparation et inventaire signés par ${sign.technicien.trim()} (${ligne.preparation!.photos.length} photo(s))`, {
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

  const signReceptions = useCallback(
    (
      lineIds: string[],
      input: { inventaires: Record<string, InventaireCoche>; reserves: string; photos: string[]; nom: string; signature: string },
    ) => {
      update((s) => {
        const signeeLe = nowIso();
        const reserves = input.reserves.trim();
        const events: HistoryEvent[] = [];
        const lignes = s.lignes.map((l) => {
          if (!lineIds.includes(l.id)) return l;
          const reception: Reception = {
            inventaire: input.inventaires[l.id] ?? {},
            reserves,
            photos: input.photos,
            nom: input.nom,
            signature: input.signature,
            signeeLe,
          };
          events.push(
            makeEvent("reception", `Réception signée par ${input.nom}${reserves ? " avec réserves" : " sans réserve"}`, {
              moduleId: l.moduleId ?? undefined,
              contratId: l.contratId,
            }),
          );
          return { ...l, reception };
        });
        // Une réception signée avec remarques crée une demande « Réserve » pour prévenir le bureau.
        const signees = s.lignes.filter((l) => lineIds.includes(l.id) && l.moduleId);
        const demandes =
          reserves && signees.length > 0
            ? [
                {
                  id: uid("dem"),
                  type: "reserve" as const,
                  moduleId: signees[0].moduleId!,
                  moduleIds: signees.map((l) => l.moduleId!),
                  ligneId: signees[0].id,
                  message: reserves,
                  photos: input.photos,
                  signataire: input.nom,
                  creeeLe: signeeLe,
                  traitee: false,
                },
                ...s.demandes,
              ]
            : s.demandes;
        return { ...s, lignes, demandes, historique: [...events, ...s.historique] };
      });
    },
    [update],
  );

  const createRequest = useCallback(
    (input: {
      type: RequestType;
      moduleId: string;
      message: string;
      dateSouhaitee?: string;
      photos: string[];
      offreId?: string;
      offreTitre?: string;
      contact?: string;
    }): ActionResult => {
      const mod = dataRef.current.modules.find((m) => m.id === input.moduleId);
      if (!mod?.ligneId) return { ok: false, error: "Ce module n'est rattaché à aucun contrat en cours." };
      const ligne = dataRef.current.lignes.find((l) => l.id === mod.ligneId);
      if (!ligne) return { ok: false, error: "Contrat introuvable." };
      if (input.type === "retour" && mod.statut !== "loue" && mod.statut !== "pret") {
        return { ok: false, error: "Un retour ne peut être demandé que pour un module livré ou en cours de livraison." };
      }
      const demande: ClientRequest = {
        id: uid("dem"),
        type: input.type,
        moduleId: mod.id,
        ligneId: ligne.id,
        message: input.message.trim(),
        dateSouhaitee: input.dateSouhaitee,
        photos: input.photos,
        offreId: input.offreId,
        offreTitre: input.offreTitre,
        contact: input.contact?.trim() || undefined,
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
              : input.type === "devis"
                ? `Demande de devis : ${input.offreTitre ?? ""}`
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

  /** Une seule demande de retour pour tous les modules rendus ensemble. */
  const requestReturn = useCallback(
    (moduleIds: string[], dateSouhaitee: string, message: string): ActionResult => {
      const d = dataRef.current;
      if (moduleIds.length === 0) return { ok: false, error: "Sélectionnez au moins un module." };
      const mods = moduleIds.map((id) => d.modules.find((m) => m.id === id));
      if (mods.some((m) => !m?.ligneId)) return { ok: false, error: "Un des modules n'est rattaché à aucun contrat en cours." };
      const bloque = mods.find((m) => m!.statut !== "loue" && m!.statut !== "pret");
      if (bloque) return { ok: false, error: `Le module ${bloque.numero} ne peut pas être rendu (il n'est pas chez le client).` };
      const ligneIds = mods.map((m) => m!.ligneId!);
      const lignes = ligneIds.map((id) => d.lignes.find((l) => l.id === id)!);
      const demande: ClientRequest = {
        id: uid("dem"),
        type: "retour",
        moduleId: moduleIds[0],
        moduleIds,
        ligneId: ligneIds[0],
        ligneIds,
        message: message.trim(),
        dateSouhaitee,
        photos: [],
        creeeLe: nowIso(),
        traitee: false,
      };
      const ids = new Set(ligneIds);
      const modSet = new Set(moduleIds);
      update((s) => ({
        ...s,
        demandes: [demande, ...s.demandes],
        modules: s.modules.map((m) => (modSet.has(m.id) ? { ...m, statut: "retour_demande" } : m)),
        lignes: s.lignes.map((l) => (ids.has(l.id) ? { ...l, statut: "retour_demande", dateRetourSouhaitee: dateSouhaitee } : l)),
        historique: [
          ...lignes.map((l) =>
            makeEvent("retour_demande", `Retour demandé pour le ${formatDate(dateSouhaitee)} (${moduleIds.length} module(s))`, {
              moduleId: l.moduleId ?? undefined,
              contratId: l.contratId,
            }),
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
    const empty = emptyData();
    if (remoteEnabled) {
      await deleteAllRecords();
      syncedRef.current = empty;
    }
    await clearPhotos();
    setData(empty);
  }, []);

  const replaceAll = useCallback((next: AppData) => {
    setData(applyAutoTransitions(normalize(next)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      ready,
      syncStatus,
      syncError,
      addModule,
      updateModule,
      deleteModule,
      importRows,
      createContract,
      updateContract,
      addLines,
      setLineDateFin,
      setContractDateFin,
      setDeliveryDate,
      setAccessoirePret,
      setReturnDate,
      assignModule,
      unassignModule,
      updatePreparation,
      validatePreparation,
      registerReturn,
      saveConstat,
      startRepair,
      finishRepair,
      signReceptions,
      createRequest,
      requestReturn,
      setRequestHandled,
      updateSettings,
      resetAll,
      replaceAll,
    }),
    [
      data,
      ready,
      syncStatus,
      syncError,
      addModule,
      updateModule,
      deleteModule,
      importRows,
      createContract,
      updateContract,
      addLines,
      setLineDateFin,
      setContractDateFin,
      setDeliveryDate,
      setAccessoirePret,
      setReturnDate,
      assignModule,
      unassignModule,
      updatePreparation,
      validatePreparation,
      registerReturn,
      saveConstat,
      startRepair,
      finishRepair,
      signReceptions,
      createRequest,
      requestReturn,
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
