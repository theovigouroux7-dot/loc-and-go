"use client";

import { Hammer, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Scanner } from "@/components/Scanner";
import { Alert, Button, Card, LineStatusBadge, ModuleStatusBadge, PageHeader } from "@/components/ui";
import { findModuleByNumero, useStore } from "@/lib/store";
import { formatDate, parseScan, today } from "@/lib/utils";

export default function AtelierPage() {
  const { data, registerReturn, startRepair, finishRepair } = useStore();
  const router = useRouter();
  const [scanError, setScanError] = useState("");
  const day = today();
  const moduleById = new Map(data.modules.map((m) => [m.id, m]));
  const contratById = new Map(data.contrats.map((c) => [c.id, c]));

  const aPreparer = data.lignes
    .filter((l) => l.statut === "a_preparer" || l.statut === "en_preparation")
    .sort((a, b) => (a.dateDebut || "9999").localeCompare(b.dateDebut || "9999"));
  const prets = data.lignes.filter((l) => l.statut === "prete").sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  const retoursAttendus = data.lignes
    .filter((l) => l.statut === "retour_demande")
    .sort((a, b) => (a.dateRetourSouhaitee || "").localeCompare(b.dateRetourSouhaitee || ""));
  const aConstater = data.lignes.filter((l) => l.statut === "retournee");
  const aReparer = data.modules.filter((m) => m.statut === "a_remettre" || m.statut === "reparation");

  const onScanRetour = (text: string) => {
    setScanError("");
    const { moduleId, raw } = parseScan(text);
    const mod = moduleId ? moduleById.get(moduleId) : findModuleByNumero(data, raw);
    if (!mod) return setScanError(`Aucun module « ${raw} » dans le parc.`);
    const ligneId = mod.ligneId;
    const res = registerReturn(mod.id);
    if (!res.ok) return setScanError(res.error);
    if (ligneId) router.push(`/atelier/constat/${ligneId}`);
  };

  return (
    <>
      <PageHeader title="Atelier" description="Préparation des départs, retours au parc, constats et remises en état." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Ordres de préparation (${aPreparer.length})`}>
          {aPreparer.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun module à préparer.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {aPreparer.map((l) => {
                const c = contratById.get(l.contratId);
                const m = l.moduleId ? moduleById.get(l.moduleId) : undefined;
                const urgent = l.dateDebut && l.dateDebut <= day;
                return (
                  <li key={l.id}>
                    <Link href={`/atelier/preparation/${l.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {l.typeDemande || "Module"}
                          {m && <span className="text-slate-500"> · {m.numero}</span>}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {c?.reference} · {c?.client || "—"} · {c?.ville || "—"}
                        </p>
                        <p className={`text-xs ${urgent ? "font-medium text-rose-600" : "text-slate-500"}`}>Livraison {formatDate(l.dateDebut)}</p>
                      </div>
                      <LineStatusBadge statut={l.statut} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Enregistrer un retour au parc">
          <p className="mb-3 text-sm text-slate-600">Scannez le QR code du module qui rentre (ou saisissez son numéro). Le constat s&apos;ouvre ensuite.</p>
          <Scanner onResult={onScanRetour} />
          {scanError && (
            <div className="mt-3">
              <Alert tone="red">{scanError}</Alert>
            </div>
          )}
        </Card>

        <Card title={`Retours attendus (${retoursAttendus.length})`}>
          {retoursAttendus.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun retour demandé.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {retoursAttendus.map((l) => {
                const c = contratById.get(l.contratId);
                const m = l.moduleId ? moduleById.get(l.moduleId) : undefined;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <Link href={`/parc/${m?.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {m?.numero}
                      </Link>
                      <span className="text-slate-500"> · {c?.client || c?.reference} · {c?.ville}</span>
                    </div>
                    <span className="font-medium text-slate-700">{formatDate(l.dateRetourSouhaitee)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`Constats à faire (${aConstater.length})`}>
          {aConstater.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun module en attente de constat.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {aConstater.map((l) => {
                const m = l.moduleId ? moduleById.get(l.moduleId) : undefined;
                const c = contratById.get(l.contratId);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <strong className="text-slate-900">{m?.numero}</strong>
                      <span className="text-slate-500"> · {c?.reference}</span>
                    </span>
                    <Link href={`/atelier/constat/${l.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                      Faire le constat →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`Prêts, en attente de livraison (${prets.length})`}>
          {prets.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun module prêt.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {prets.map((l) => {
                const m = l.moduleId ? moduleById.get(l.moduleId) : undefined;
                const c = contratById.get(l.contratId);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <Link href={`/parc/${m?.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {m?.numero}
                      </Link>
                      <span className="text-slate-500"> · {c?.reference} · {c?.ville}</span>
                    </span>
                    <span className="text-slate-600">Livraison {formatDate(l.dateDebut)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Ces modules passeront automatiquement « loués » une fois la date de livraison passée.</p>
        </Card>

        <Card title={`Remise en état (${aReparer.length})`}>
          {aReparer.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun module à réparer.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {aReparer.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <Link href={`/parc/${m.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {m.numero}
                    </Link>
                    <ModuleStatusBadge statut={m.statut} />
                  </span>
                  <span className="flex gap-2">
                    {m.statut === "a_remettre" && (
                      <Button size="sm" variant="secondary" icon={<Hammer className="h-4 w-4" />} onClick={() => startRepair(m.id)}>
                        Démarrer
                      </Button>
                    )}
                    <Button size="sm" variant="success" icon={<Wrench className="h-4 w-4" />} onClick={() => finishRepair(m.id)}>
                      Réparé
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
