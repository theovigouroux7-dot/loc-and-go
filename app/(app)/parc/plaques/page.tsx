"use client";

import clsx from "clsx";
import { Check, FileDown, Loader2, Printer, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { QrCode } from "@/components/QrCode";
import { Button, EmptyState, Input, ModuleStatusBadge, PageHeader, Select } from "@/components/ui";
import { downloadPlaquesPdf } from "@/lib/pdf";
import { useStore } from "@/lib/store";
import type { ModuleStatus } from "@/lib/types";
import { moduleUrl } from "@/lib/utils";

type Groupe = "" | "disponible" | "a_reparer" | "indisponible";

const GROUPES: Record<Exclude<Groupe, "">, ModuleStatus[]> = {
  disponible: ["disponible"],
  a_reparer: ["a_remettre", "reparation"],
  indisponible: ["reserve", "preparation", "pret", "loue", "retour_demande", "en_retour"],
};

export default function PlaquesPage() {
  return (
    <Suspense>
      <Plaques />
    </Suspense>
  );
}

function Plaques() {
  const { data } = useStore();
  const params = useSearchParams();
  const ids = params.get("ids")?.split(",").filter(Boolean);
  const [selection, setSelection] = useState<string[]>(ids ?? []);
  const [q, setQ] = useState("");
  const [agence, setAgence] = useState("");
  const [type, setType] = useState("");
  const [groupe, setGroupe] = useState<Groupe>("");
  const [busy, setBusy] = useState(false);

  const agences = useMemo(() => Array.from(new Set(data.modules.map((m) => m.depot).filter(Boolean))).sort(), [data.modules]);
  const types = useMemo(() => Array.from(new Set(data.modules.map((m) => m.type).filter(Boolean))).sort(), [data.modules]);

  const modules = data.modules
    .filter((m) => !agence || m.depot === agence)
    .filter((m) => !type || m.type === type)
    .filter((m) => !groupe || GROUPES[groupe].includes(m.statut))
    .filter((m) => !q.trim() || m.numero.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));

  const choisis = data.modules
    .filter((m) => selection.includes(m.id))
    .sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));
  const visiblesChoisis = modules.filter((m) => selection.includes(m.id)).length;
  const toggle = (id: string) => setSelection(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);
  const toutSelectionner = () => setSelection(Array.from(new Set([...selection, ...modules.map((m) => m.id)])));
  const toutRetirer = () => setSelection(selection.filter((id) => !modules.some((m) => m.id === id)));

  const pdf = async () => {
    setBusy(true);
    try {
      await downloadPlaquesPdf(choisis, data.parametres.nomLoueur);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={{ href: "/parc", label: "Parc de modules" }}
          title="Plaques QR code"
          description="Cochez les plaques à sortir, puis téléchargez le PDF : 12 plaques par page A4, avec traits de coupe. À imprimer sur un support résistant (vinyle anti-UV ou plaque alu)."
          actions={
            <>
              <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />} disabled={choisis.length === 0}>
                Imprimer
              </Button>
              <Button onClick={pdf} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} disabled={choisis.length === 0 || busy}>
                {choisis.length === 0 ? "Sélectionnez des plaques" : `Télécharger le PDF (${choisis.length})`}
              </Button>
            </>
          }
        />
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Numéro…" className="pl-9" />
            </div>
            <Select value={agence} onChange={(e) => setAgence(e.target.value)} aria-label="Agence">
              <option value="">Toutes les agences</option>
              {agences.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type de module">
              <option value="">Tous les types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select value={groupe} onChange={(e) => setGroupe(e.target.value as Groupe)} aria-label="Statut">
              <option value="">Tous les statuts</option>
              <option value="disponible">Disponibles</option>
              <option value="a_reparer">À réparer</option>
              <option value="indisponible">Indisponibles (loués, en préparation…)</option>
            </Select>
          </div>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-600">
            <strong className="text-slate-900">{choisis.length}</strong> plaque(s) sélectionnée(s)
          </span>
          {visiblesChoisis < modules.length && (
            <button onClick={toutSelectionner} className="font-medium text-brand-600 hover:text-brand-700">
              Sélectionner les {modules.length} affichée(s)
            </button>
          )}
          {visiblesChoisis > 0 && (
            <button onClick={toutRetirer} className="text-slate-500 hover:text-slate-800">
              Désélectionner les affichées
            </button>
          )}
          {selection.length > 0 && (
            <button onClick={() => setSelection([])} className="text-slate-500 hover:text-slate-800">
              Tout désélectionner
            </button>
          )}
        </div>
      </div>

      {modules.length === 0 ? (
        <EmptyState title="Aucun module ne correspond à ces filtres" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {modules.map((m) => {
            const on = selection.includes(m.id);
            return (
            <button
              type="button"
              key={m.id}
              onClick={() => toggle(m.id)}
              aria-pressed={on}
              className={clsx(
                "relative flex break-inside-avoid flex-col items-center gap-2 rounded-xl border-2 bg-white p-4 text-center transition",
                on ? "border-brand-600 ring-2 ring-brand-200 print:border-slate-900 print:ring-0" : "border-slate-200 opacity-70 hover:opacity-100 print:hidden",
              )}
            >
              <span
                className={clsx(
                  "no-print absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border",
                  on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white",
                )}
              >
                {on && <Check className="h-3.5 w-3.5" />}
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{data.parametres.nomLoueur}</p>
              <QrCode value={moduleUrl(m.id)} size={140} />
              <p className="text-xl font-bold tracking-wide text-slate-900">{m.numero}</p>
              <p className="text-[11px] leading-tight text-slate-600">Scannez pour votre contrat, un SAV ou un retour</p>
              <div className="no-print mt-1">
                <ModuleStatusBadge statut={m.statut} />
              </div>
            </button>
            );
          })}
        </div>
      )}
    </>
  );
}
