"use client";

import { FileSearch, Loader2, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { saveDocument } from "@/lib/photos";
import type { ContractInput, LineRequest } from "@/lib/store";
import type { ContractDocument } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";
import { Alert, Button } from "./ui";
import { useTermes } from "@/lib/store";
import { Verrou } from "@/components/Demo";
import { useEssai } from "@/components/Espace";

export interface Analyse {
  reference: string;
  client: string;
  adresse: string;
  ville: string;
  dateLivraison: string;
  dateFin: string;
  notes: string;
  prolongation: boolean;
  accessoires: { nom: string; quantite: number }[];
  groupes: { type: string; designation: string; quantite: number; numeros: string[]; equipements: { nom: string; quantite: number }[] }[];
}

/** Dépôt d'un contrat (PDF ou photo) : Claude le lit et pré-remplit le formulaire, que le bureau vérifie. */
export function ContractAnalyzer({
  catalogue,
  types,
  onResult,
}: {
  catalogue: string[];
  types: string[];
  onResult: (form: Partial<ContractInput>, demandes: LineRequest[], document: ContractDocument | null) => void;
}) {
  const t = useTermes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const essai = useEssai();

  const analyser = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (file.size > 4 * 1024 * 1024) {
      setMessage({ tone: "red", text: "Fichier trop lourd : 4 Mo maximum. Pour une photo, réduisez sa taille ou envoyez le PDF." });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("fichier", file);
      body.append("catalogue", JSON.stringify(catalogue));
      body.append("types", JSON.stringify(types));
      const res = await fetch("/api/analyse-contrat", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { resultat?: Analyse; error?: string };
      if (!res.ok || !json.resultat) throw new Error(json.error || "L'analyse a échoué.");
      const r = json.resultat;
      const form: Partial<ContractInput> = {};
      for (const k of ["reference", "client", "adresse", "ville", "dateLivraison", "dateFin", "notes"] as const) if (r[k]) form[k] = r[k];
      if (r.accessoires?.length) form.accessoires = r.accessoires.map((a) => ({ id: uid("acc"), nom: a.nom, quantite: a.quantite, pret: false }));
      const demandes: LineRequest[] = r.groupes.map((g) => ({
        type: g.type || g.designation,
        designation: g.designation,
        quantite: g.quantite,
        numeros: g.numeros,
        equipements: Object.fromEntries(g.equipements.map((e) => [e.nom, e.quantite])),
      }));
      // Le contrat analysé est joint automatiquement au contrat créé.
      let document: ContractDocument | null = null;
      try {
        const saved = await saveDocument(file);
        document = { id: saved.id, nom: file.name, type: "contrat", mime: saved.mime, ajouteLe: nowIso() };
      } catch {
        /* le contrat reste créé sans la pièce jointe */
      }
      onResult(form, demandes, document);
      const nbModules = demandes.reduce((s, d) => s + d.quantite, 0);
      setMessage(
        r.prolongation
          ? {
              tone: "red",
              text: `Attention : c'est une prolongation (${t.n(nbModules)} déjà chez le client). Plutôt que de créer un nouveau contrat, prolongez le contrat existant depuis sa fiche.`,
            }
          : {
              tone: "green",
              text: `Contrat lu : ${t.n(nbModules)} en ${demandes.length} groupe(s)${r.accessoires?.length ? `, ${r.accessoires.length} accessoire(s)` : ""}. Transport et montage ont été écartés. Vérifiez chaque champ avant d'enregistrer.`,
            },
      );
    } catch (err) {
      setMessage({ tone: "red", text: err instanceof Error ? err.message : "L'analyse a échoué." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (essai) {
    return (
      <Verrou
        titre="Lecture automatique du contrat par Claude"
        description={`Déposez le PDF du contrat : client, chantier, dates, ${t.p} et éléments fournis sont pré-remplis.`}
        className="mb-6"
      />
    );
  }

  return (
    <section className="mb-6 rounded-xl bg-gradient-to-r from-brand-50 to-white p-5 ring-1 ring-brand-200">
      <div
        className={`flex flex-col items-start gap-4 sm:flex-row sm:items-center ${drag ? "opacity-70" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          analyser(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-brand-600 text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Remplir automatiquement depuis le contrat</p>
          <p className="text-sm text-slate-600">
            Déposez le PDF (ou une photo) du contrat : client, chantier, dates, {t.p} et éléments fournis sont pré-remplis. Vous vérifiez, puis vous enregistrez.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        >
          {busy ? "Lecture du contrat…" : "Déposer le contrat"}
        </Button>
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => analyser(e.target.files?.[0])} />
      </div>
      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-brand-700">
          <FileSearch className="h-4 w-4" /> Claude lit le contrat, cela prend en général 10 à 30 secondes.
        </p>
      )}
      {message && (
        <div className="mt-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
    </section>
  );
}
