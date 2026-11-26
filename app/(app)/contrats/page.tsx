"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, ButtonLink, EmptyState, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { useStore, useTermes } from "@/lib/store";
import type { Contract, ContractLine } from "@/lib/types";
import { addDays, formatDate, today } from "@/lib/utils";

type Etat = "a_venir" | "en_cours" | "termine";

function etatContrat(lignes: ContractLine[]): Etat {
  if (lignes.length > 0 && lignes.every((l) => l.statut === "cloturee")) return "termine";
  if (lignes.some((l) => ["en_cours", "retour_demande", "retournee"].includes(l.statut))) return "en_cours";
  return "a_venir";
}

const ETAT_LABEL: Record<Etat, { label: string; tone: "amber" | "slate" | "green" }> = {
  a_venir: { label: "À venir", tone: "amber" },
  en_cours: { label: "En cours", tone: "slate" },
  termine: { label: "Terminé", tone: "green" },
};

export default function ContratsPage() {
  const t = useTermes();
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [etat, setEtat] = useState<Etat | "">("");
  const [fin, setFin] = useState<"" | "30" | "depasse">("");
  const day = today();

  const lignesParContrat = useMemo(() => {
    const map = new Map<string, ContractLine[]>();
    for (const l of data.lignes) map.set(l.contratId, [...(map.get(l.contratId) ?? []), l]);
    return map;
  }, [data.lignes]);

  const rows = data.contrats
    .map((c) => ({ c, lignes: lignesParContrat.get(c.id) ?? [], etat: etatContrat(lignesParContrat.get(c.id) ?? []) }))
    .filter((r) => !etat || r.etat === etat)
    .filter((r) => {
      if (!fin) return true;
      if (!r.c.dateFin || r.etat === "termine") return false;
      if (fin === "30") return r.c.dateFin >= day && r.c.dateFin <= addDays(day, 30);
      return r.c.dateFin < day;
    })
    .filter((r) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      const numeros = r.lignes.map((l) => data.modules.find((m) => m.id === l.moduleId)?.numero ?? "");
      return [r.c.reference, r.c.client, r.c.ville, r.c.adresse, ...numeros].some((v) => v.toLowerCase().includes(needle));
    })
    .sort((a, b) => b.c.creeLe.localeCompare(a.c.creeLe));

  return (
    <>
      <PageHeader
        title="Contrats"
        description={`Chaque contrat est une liste de lignes : une ligne par ${t.s}, avec ses dates.`}
        actions={
          <ButtonLink href="/contrats/nouveau" icon={<Plus className="h-4 w-4" />}>
            Nouveau contrat
          </ButtonLink>
        }
      />

      {data.contrats.length === 0 ? (
        <EmptyState
          title="Aucun contrat"
          description="Enregistrez un contrat pour déclencher les ordres de préparation à l'atelier."
          action={<ButtonLink href="/contrats/nouveau">Nouveau contrat</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Référence, client, ville, numéro ${t.de}…`} className="pl-9" />
            </div>
            <Select value={etat} onChange={(e) => setEtat(e.target.value as Etat | "")} aria-label="Filtrer par état">
              <option value="">Tous les états</option>
              <option value="a_venir">À venir</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminés</option>
            </Select>
            <Select value={fin} onChange={(e) => setFin(e.target.value as "" | "30" | "depasse")} aria-label="Filtrer par date de fin">
              <option value="">Toutes les dates de fin</option>
              <option value="30">Fin dans les 30 jours</option>
              <option value="depasse">Date de fin dépassée</option>
            </Select>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="Aucun contrat ne correspond à ces filtres" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Référence</Th>
                  <Th>Client</Th>
                  <Th>Chantier</Th>
                  <Th>{t.P}</Th>
                  <Th>Livraison</Th>
                  <Th>Fin</Th>
                  <Th>État</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ c, lignes, etat: e }) => (
                  <ContractRow key={c.id} c={c} lignes={lignes} etat={e} day={day} />
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </>
  );
}

function ContractRow({ c, lignes, etat, day }: { c: Contract; lignes: ContractLine[]; etat: Etat; day: string }) {
  const actives = lignes.filter((l) => l.statut !== "cloturee").length;
  const aPreparer = lignes.filter((l) => l.statut === "a_preparer").length;
  const finDepassee = c.dateFin && c.dateFin < day && etat !== "termine";
  return (
    <tr className="hover:bg-slate-50">
      <Td>
        <Link href={`/contrats/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
          {c.reference}
        </Link>
        {c.importe && <span className="ml-2 text-xs text-slate-400">repris</span>}
      </Td>
      <Td>{c.client || <span className="text-slate-300">—</span>}</Td>
      <Td>{c.ville || <span className="text-slate-300">—</span>}</Td>
      <Td>
        {actives} / {lignes.length}
        {aPreparer > 0 && <span className="ml-2 text-xs text-amber-700">{aPreparer} à préparer</span>}
      </Td>
      <Td>{formatDate(c.dateLivraison)}</Td>
      <Td className={finDepassee ? "font-medium text-rose-600" : undefined}>{formatDate(c.dateFin)}</Td>
      <Td>
        <Badge tone={ETAT_LABEL[etat].tone}>{ETAT_LABEL[etat].label}</Badge>
      </Td>
    </tr>
  );
}
