"use client";

import { FileDown, Loader2, Printer, Search } from "lucide-react";
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
  const [q, setQ] = useState("");
  const [agence, setAgence] = useState("");
  const [type, setType] = useState("");
  const [groupe, setGroupe] = useState<Groupe>("");
  const [busy, setBusy] = useState(false);

  const agences = useMemo(() => Array.from(new Set(data.modules.map((m) => m.depot).filter(Boolean))).sort(), [data.modules]);
  const types = useMemo(() => Array.from(new Set(data.modules.map((m) => m.type).filter(Boolean))).sort(), [data.modules]);

  const modules = data.modules
    .filter((m) => !ids || ids.includes(m.id))
    .filter((m) => !agence || m.depot === agence)
    .filter((m) => !type || m.type === type)
    .filter((m) => !groupe || GROUPES[groupe].includes(m.statut))
    .filter((m) => !q.trim() || m.numero.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));

  const pdf = async () => {
    setBusy(true);
    try {
      await downloadPlaquesPdf(modules, data.parametres.nomLoueur);
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
          description="12 plaques par page A4, avec traits de coupe. À imprimer sur un support résistant (vinyle anti-UV ou plaque alu) et à coller près de la porte, à l'intérieur."
          actions={
            <>
              <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />} disabled={modules.length === 0}>
                Imprimer
              </Button>
              <Button onClick={pdf} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} disabled={modules.length === 0 || busy}>
                Télécharger le PDF ({modules.length})
              </Button>
            </>
          }
        />
        {!ids && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        )}
      </div>

      {modules.length === 0 ? (
        <EmptyState title="Aucun module ne correspond à ces filtres" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {modules.map((m) => (
            <div key={m.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border-2 border-slate-900 bg-white p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{data.parametres.nomLoueur}</p>
              <QrCode value={moduleUrl(m.id)} size={140} />
              <p className="text-xl font-bold tracking-wide text-slate-900">{m.numero}</p>
              <p className="text-[11px] leading-tight text-slate-600">Scannez pour votre contrat, un SAV ou un retour</p>
              <div className="no-print mt-1">
                <ModuleStatusBadge statut={m.statut} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
