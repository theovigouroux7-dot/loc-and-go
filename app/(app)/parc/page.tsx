"use client";

import { FileUp, Printer, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ButtonLink, EmptyState, Input, ModuleStatusBadge, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { MODULE_STATUS, MODULE_STATUS_ORDER } from "@/lib/status";
import { useEspace } from "@/components/Espace";
import { useStore, useTermes } from "@/lib/store";
import type { ModuleStatus } from "@/lib/types";

export default function ParcPage() {
  return (
    <Suspense>
      <ParcContent />
    </Suspense>
  );
}

function ParcContent() {
  const t = useTermes();
  const espace = useEspace();
  const { data } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [depot, setDepot] = useState("");
  const statut = (params.get("statut") ?? "") as ModuleStatus | "";

  const setStatut = (value: string) => {
    router.replace(value ? `/parc?statut=${value}` : "/parc");
  };

  const types = useMemo(() => Array.from(new Set(data.modules.map((m) => m.type).filter(Boolean))).sort(), [data.modules]);
  const depots = useMemo(() => Array.from(new Set(data.modules.map((m) => m.depot).filter(Boolean))).sort(), [data.modules]);
  const lignes = useMemo(() => new Map(data.lignes.map((l) => [l.id, l])), [data.lignes]);
  const contrats = useMemo(() => new Map(data.contrats.map((c) => [c.id, c])), [data.contrats]);

  const filtered = data.modules
    .filter((m) => !statut || m.statut === statut)
    .filter((m) => !type || m.type === type)
    .filter((m) => !depot || m.depot === depot)
    .filter((m) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      const ligne = m.ligneId ? lignes.get(m.ligneId) : undefined;
      const contrat = ligne ? contrats.get(ligne.contratId) : undefined;
      return [m.numero, m.type, m.dimensions, m.equipements, m.depot, contrat?.reference, contrat?.client, contrat?.ville]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    })
    .sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));

  const counts = MODULE_STATUS_ORDER.map((s) => [s, data.modules.filter((m) => m.statut === s).length] as const);

  return (
    <>
      <PageHeader
        title="Parc matériel"
        description={`${t.n(data.modules.length)} au total${espace.limiteMateriels !== null ? ` · version d'essai : ${data.modules.length} / ${espace.limiteMateriels} QR codes` : ""}`}
        actions={
          <>
            <ButtonLink href="/parc/plaques" variant="secondary" icon={<Printer className="h-4 w-4" />}>
              Imprimer les QR codes
            </ButtonLink>
            <ButtonLink href="/import" icon={<FileUp className="h-4 w-4" />}>
              Ajouter {t.deP}
            </ButtonLink>
          </>
        }
      />

      {data.modules.length === 0 ? (
        <EmptyState
          title={`${t.Aucun} ${t.s} dans le parc`}
          description="Intégrez vos numéros de parc pour commencer le suivi."
          action={<ButtonLink href="/import">Importer vos {t.p}</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setStatut("")}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${!statut ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}
            >
              Tous ({data.modules.length})
            </button>
            {counts
              .filter(([, n]) => n > 0)
              .map(([s, n]) => (
                <button
                  key={s}
                  onClick={() => setStatut(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${statut === s ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}
                >
                  {MODULE_STATUS[s].label} ({n})
                </button>
              ))}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un numéro, un client, une ville…" className="pl-9" />
            </div>
            <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filtrer par type">
              <option value="">Tous les types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select value={depot} onChange={(e) => setDepot(e.target.value)} aria-label="Filtrer par agence">
              <option value="">Toutes les agences</option>
              {depots.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={`${t.Aucun} ${t.s} ne correspond à ces filtres`} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Numéro</Th>
                  <Th>Type</Th>
                  <Th>Caractéristiques</Th>
                  <Th>Agence</Th>
                  <Th>Statut</Th>
                  <Th>Contrat en cours</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => {
                  const ligne = m.ligneId ? lignes.get(m.ligneId) : undefined;
                  const contrat = ligne ? contrats.get(ligne.contratId) : undefined;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <Td>
                        <Link href={`/parc/${m.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                          {m.numero}
                        </Link>
                      </Td>
                      <Td>{m.type || <span className="text-slate-300">—</span>}</Td>
                      <Td>{m.dimensions || <span className="text-slate-300">—</span>}</Td>
                      <Td>{m.depot || <span className="text-slate-300">—</span>}</Td>
                      <Td>
                        <ModuleStatusBadge statut={m.statut} />
                      </Td>
                      <Td>
                        {contrat ? (
                          <Link href={`/contrats/${contrat.id}`} className="hover:text-brand-700">
                            {contrat.reference}
                            <span className="text-slate-400"> · {contrat.client || contrat.ville}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
      )}
    </>
  );
}
