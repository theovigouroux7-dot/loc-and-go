"use client";

import { ArrowRight, FileUp, Plus } from "lucide-react";
import Link from "next/link";
import { ContractsToPrepareList, useContratsAPreparer } from "@/components/ContractsToPrepare";
import { ButtonLink, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { useStore } from "@/lib/store";
import { addDays, daysBetween, formatDate, formatDateTime, today } from "@/lib/utils";

export default function DashboardPage() {
  const { data } = useStore();
  const { modules, lignes, contrats, demandes, historique } = data;
  const day = today();
  const contratById = new Map(contrats.map((c) => [c.id, c]));
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const count = (statuts: string[]) => modules.filter((m) => statuts.includes(m.statut)).length;

  const contratsAPreparer = useContratsAPreparer();
  const retours = lignes
    .filter((l) => l.statut === "retour_demande")
    .sort((a, b) => (a.dateRetourSouhaitee || "").localeCompare(b.dateRetourSouhaitee || ""));
  const finsProches = contrats
    .filter((c) => c.dateFin && c.dateFin >= day && c.dateFin <= addDays(day, 30))
    .filter((c) => lignes.some((l) => l.contratId === c.id && ["en_cours", "prete"].includes(l.statut)))
    .sort((a, b) => a.dateFin.localeCompare(b.dateFin));
  const nouvelles = demandes.filter((d) => !d.traitee);

  if (modules.length === 0) {
    return (
      <>
        <PageHeader title="Bienvenue dans Loc and Go" description="Le parc est vide. Commencez par intégrer vos modules : c'est la première étape du suivi." />
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="1. Intégrer le parc">
            <p className="mb-4 text-sm text-slate-600">
              Importez un fichier Excel ou CSV tiré de votre logiciel actuel, collez une liste de numéros, ou ajoutez les modules un par un. Chaque module reçoit son QR code.
            </p>
            <ButtonLink href="/import" icon={<FileUp className="h-4 w-4" />}>
              Importer des modules
            </ButtonLink>
          </Card>
          <Card title="Ensuite">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
              <li>Enregistrer un contrat (client, chantier, date de livraison, modules demandés).</li>
              <li>À l&apos;atelier : scanner le module, prendre les photos, cocher l&apos;inventaire.</li>
              <li>Côté client : scanner le QR code, contrôler et signer la réception.</li>
              <li>Au retour : constat de l&apos;atelier, puis remise en stock ou réparation.</li>
            </ol>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`${modules.length} module(s) dans le parc · ${formatDate(day)}`}
        actions={
          <ButtonLink href="/contrats/nouveau" icon={<Plus className="h-4 w-4" />}>
            Nouveau contrat
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Disponibles" value={count(["disponible"])} tone="green" href="/parc?statut=disponible" />
        <Stat label="En préparation" value={count(["reserve", "preparation", "pret"])} href="/atelier" />
        <Stat label="Loués" value={count(["loue"])} href="/parc?statut=loue" />
        <Stat label="Retours demandés" value={count(["retour_demande"])} tone="amber" href="/parc?statut=retour_demande" />
        <Stat label="En retour" value={count(["en_retour"])} tone="amber" href="/atelier" />
        <Stat label="À réparer" value={count(["a_remettre", "reparation"])} tone="red" href="/atelier" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card
          title={`Contrats à préparer (${contratsAPreparer.length})`}
          actions={
            <Link href="/atelier" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Atelier →
            </Link>
          }
        >
          <ContractsToPrepareList items={contratsAPreparer} limit={6} />
        </Card>

        <Card
          title={`Demandes clients non traitées (${nouvelles.length})`}
          actions={
            <Link href="/demandes" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Tout voir →
            </Link>
          }
        >
          {nouvelles.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune demande en attente.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {nouvelles.slice(0, 6).map((d) => {
                const m = moduleById.get(d.moduleId);
                return (
                  <li key={d.id} className="py-2.5 text-sm">
                    <p className="font-medium text-slate-900">
                      {d.type === "sav" ? "SAV" : "Retour"} · module {m?.numero}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {d.type === "retour" ? `Souhaité le ${formatDate(d.dateSouhaitee)}` : d.message || "Sans détail"} · {formatDateTime(d.creeeLe)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`Retours prévus (${retours.length})`}>
          {retours.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun retour demandé.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {retours.map((l) => {
                const c = contratById.get(l.contratId);
                const m = l.moduleId ? moduleById.get(l.moduleId) : undefined;
                return (
                  <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>
                      <Link href={`/parc/${m?.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {m?.numero}
                      </Link>
                      <span className="text-slate-500"> · {c?.client || c?.reference} · {c?.ville}</span>
                    </span>
                    <span className="text-slate-700">{formatDate(l.dateRetourSouhaitee)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`Fins de contrat dans les 30 jours (${finsProches.length})`}>
          {finsProches.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune fin de contrat proche.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {finsProches.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <Link href={`/contrats/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {c.reference} · {c.client}
                  </Link>
                  <span className="text-amber-700">
                    {formatDate(c.dateFin)} (J-{daysBetween(day, c.dateFin)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Activité récente" className="mt-6">
        {historique.length === 0 ? (
          <EmptyState title="Aucune activité" />
        ) : (
          <ul className="space-y-2.5">
            {historique.slice(0, 10).map((e) => {
              const m = e.moduleId ? moduleById.get(e.moduleId) : undefined;
              return (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <span className="w-36 flex-none text-xs text-slate-400">{formatDateTime(e.date)}</span>
                  <span className="text-slate-700">
                    {m && (
                      <Link href={`/parc/${m.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {m.numero}
                      </Link>
                    )}
                    {m && " — "}
                    {e.message}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4">
          <Link href="/parc" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
            Voir le parc <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>
    </>
  );
}
