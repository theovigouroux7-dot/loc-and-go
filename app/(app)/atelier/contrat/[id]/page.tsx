"use client";

import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ButtonLink, EmptyState, LineStatusBadge, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
import { formatDate, formatDateTime, today } from "@/lib/utils";

const ORDRE = ["en_preparation", "a_preparer", "prete", "en_cours", "retour_demande", "retournee", "cloturee"];

export default function AtelierContratPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useStore();
  const contrat = data.contrats.find((c) => c.id === id);
  if (!contrat) return <EmptyState title="Contrat introuvable" action={<ButtonLink href="/atelier">Retour à l'atelier</ButtonLink>} />;

  const lignes = data.lignes
    .filter((l) => l.contratId === contrat.id && l.statut !== "cloturee")
    .sort((a, b) => ORDRE.indexOf(a.statut) - ORDRE.indexOf(b.statut));
  const aFaire = lignes.filter((l) => l.statut === "a_preparer" || l.statut === "en_preparation");
  const depart = lignes.filter((l) => ["a_preparer", "en_preparation", "prete"].includes(l.statut));
  const livraison = aFaire.map((l) => l.dateDebut).filter(Boolean).sort()[0] || contrat.dateLivraison;
  const urgent = livraison && livraison <= today();

  // Total des équipements à installer pour les modules restant à préparer.
  const totaux: Record<string, number> = {};
  for (const l of aFaire) for (const [nom, q] of Object.entries(l.equipementsPrevus ?? {})) totaux[nom] = (totaux[nom] ?? 0) + q;

  return (
    <>
      <PageHeader
        back={{ href: "/atelier", label: "Atelier" }}
        title={`Contrat ${contrat.reference}`}
        description={
          <>
            {contrat.client || "Client non renseigné"} · {[contrat.adresse, contrat.ville].filter(Boolean).join(", ") || "chantier non renseigné"} ·{" "}
            <span className={urgent ? "font-medium text-rose-600" : undefined}>livraison {formatDate(livraison)}</span>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">À préparer</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{aFaire.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prêts au départ</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {depart.length - aFaire.length} / {depart.length}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Équipements à sortir</p>
          {Object.keys(totaux).length === 0 ? (
            <p className="mt-1 text-sm text-amber-900">Aucun</p>
          ) : (
            <p className="mt-1 text-sm font-medium text-amber-950">
              {Object.entries(totaux)
                .map(([nom, q]) => `${q} ${nom}`)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      {contrat.notes && (
        <div className="mb-6 rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Notes du bureau</p>
          <p className="whitespace-pre-line">{contrat.notes}</p>
        </div>
      )}

      {lignes.length === 0 ? (
        <EmptyState title="Aucun module sur ce contrat" />
      ) : (
        <ul className="space-y-3">
          {lignes.map((l, i) => {
            const m = l.moduleId ? data.modules.find((x) => x.id === l.moduleId) : undefined;
            const prevus = Object.entries(l.equipementsPrevus ?? {});
            const actif = l.statut === "a_preparer" || l.statut === "en_preparation";
            return (
              <li key={l.id}>
                <Link
                  href={`/atelier/preparation/${l.id}`}
                  className={clsx(
                    "flex items-start gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 transition hover:ring-brand-500",
                    actif ? "ring-slate-200" : "opacity-70 ring-slate-100",
                  )}
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{l.typeDemande || "Module"}</p>
                      {m ? <span className="text-sm text-slate-600">· {m.numero}</span> : <span className="text-sm text-slate-400">· module à choisir</span>}
                      <LineStatusBadge statut={l.statut} />
                    </div>
                    {l.designation && <p className="text-xs text-slate-500">{l.designation}</p>}
                    <p className="mt-2 text-sm text-slate-800">
                      <span className="font-medium">À installer : </span>
                      {prevus.length === 0 ? <span className="text-slate-500">aucun équipement prévu</span> : prevus.map(([nom, q]) => `${q} × ${nom}`).join(" · ")}
                    </p>
                    {l.preparation?.technicien && (
                      <p className="mt-1 text-xs text-emerald-700">
                        Inventaire signé par {l.preparation.technicien} le {formatDateTime(l.preparation.valideeLe)}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 flex-none text-slate-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
