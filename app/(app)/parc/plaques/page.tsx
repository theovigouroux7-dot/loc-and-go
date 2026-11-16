"use client";

import { Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { QrCode } from "@/components/QrCode";
import { Button, EmptyState, Input, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
import { moduleUrl } from "@/lib/utils";

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

  const modules = data.modules
    .filter((m) => !ids || ids.includes(m.id))
    .filter((m) => !q.trim() || m.numero.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={{ href: "/parc", label: "Parc de modules" }}
          title="Plaques QR code"
          description="Une plaque par module, à imprimer sur un support résistant (vinyle anti-UV ou plaque alu) et à coller près de la porte, à l'intérieur."
          actions={
            <Button onClick={() => window.print()} icon={<Printer className="h-4 w-4" />} disabled={modules.length === 0}>
              Imprimer {modules.length} plaque(s)
            </Button>
          }
        />
        {!ids && (
          <div className="mb-6 max-w-sm">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer par numéro…" />
          </div>
        )}
      </div>

      {modules.length === 0 ? (
        <EmptyState title="Aucun module à imprimer" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {modules.map((m) => (
            <div key={m.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border-2 border-slate-900 bg-white p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{data.parametres.nomLoueur}</p>
              <QrCode value={moduleUrl(m.id)} size={140} />
              <p className="text-xl font-bold tracking-wide text-slate-900">{m.numero}</p>
              <p className="text-[11px] leading-tight text-slate-600">Scannez pour votre contrat, un SAV ou un retour</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
