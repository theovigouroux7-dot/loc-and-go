"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useStore, useTermes } from "@/lib/store";
import type { Contract, ContractLine } from "@/lib/types";
import { formatDate, today } from "@/lib/utils";

export interface ContratAPreparer {
  contrat: Contract;
  aFaire: ContractLine[];
  total: number;
  prets: number;
  livraison: string;
  accessoiresRestants: number;
}

/** Contrats qui ont encore des modules à préparer, du plus urgent au moins urgent. */
export function useContratsAPreparer(): ContratAPreparer[] {
  const { data } = useStore();
  return data.contrats
    .map((contrat) => {
      const lignes = data.lignes.filter((l) => l.contratId === contrat.id);
      const aFaire = lignes.filter((l) => l.statut === "a_preparer" || l.statut === "en_preparation");
      const depart = lignes.filter((l) => ["a_preparer", "en_preparation", "prete"].includes(l.statut));
      const livraison = aFaire.map((l) => l.dateDebut).filter(Boolean).sort()[0] || contrat.dateLivraison;
      const accessoiresRestants = (contrat.accessoires ?? []).filter((a) => !a.pret).length;
      return { contrat, aFaire, total: depart.length, prets: depart.length - aFaire.length, livraison, accessoiresRestants };
    })
    .filter((x) => x.aFaire.length > 0 || (x.accessoiresRestants > 0 && x.total > 0))
    .sort((a, b) => (a.livraison || "9999").localeCompare(b.livraison || "9999"));
}

export function ContractsToPrepareList({ items, limit }: { items: ContratAPreparer[]; limit?: number }) {
  const t = useTermes();
  const day = today();
  if (items.length === 0) return <p className="text-sm text-slate-500">Aucun contrat à préparer.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.slice(0, limit ?? items.length).map(({ contrat, aFaire, total, prets, livraison, accessoiresRestants }) => {
        const urgent = livraison && livraison <= day;
        return (
          <li key={contrat.id}>
            <Link href={`/atelier/contrat/${contrat.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {contrat.reference}
                  <span className="font-normal text-slate-500"> · {contrat.client || "Client non renseigné"}</span>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[contrat.adresse, contrat.ville].filter(Boolean).join(", ") || "Chantier non renseigné"}
                </p>
                <p className={`text-xs ${urgent ? "font-medium text-rose-600" : "text-slate-500"}`}>Livraison {formatDate(livraison)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{t.n(aFaire.length)} à préparer</p>
                <p className="text-xs text-slate-500">
                  {prets} / {total} prêt(s)
                  {accessoiresRestants > 0 && ` · ${accessoiresRestants} accessoire(s) à préparer`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
