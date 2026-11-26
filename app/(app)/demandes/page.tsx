"use client";

import { Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PhotoGallery } from "@/components/Photos";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui";
import { REQUEST_LABEL } from "@/lib/status";
import { useStore, useTermes } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function DemandesPage() {
  const t = useTermes();
  const { data, setRequestHandled } = useStore();
  const [voirTraitees, setVoirTraitees] = useState(false);
  const moduleById = new Map(data.modules.map((m) => [m.id, m]));
  const ligneById = new Map(data.lignes.map((l) => [l.id, l]));
  const contratById = new Map(data.contrats.map((c) => [c.id, c]));

  const demandes = data.demandes.filter((d) => voirTraitees || !d.traitee);

  return (
    <>
      <PageHeader
        title="Demandes clients"
        description="SAV, demandes de retour, réserves à la réception et demandes de devis, envoyées depuis le QR code du matériel ou saisies par le bureau."
        actions={
          <Button variant="secondary" onClick={() => setVoirTraitees(!voirTraitees)}>
            {voirTraitees ? "Masquer les demandes traitées" : "Afficher les demandes traitées"}
          </Button>
        }
      />
      {demandes.length === 0 ? (
        <EmptyState title="Aucune demande en attente" description="Les demandes envoyées par les clients depuis le QR code apparaîtront ici." />
      ) : (
        <ul className="space-y-3">
          {demandes.map((d) => {
            const m = moduleById.get(d.moduleId);
            const modules = (d.moduleIds?.length ? d.moduleIds : [d.moduleId]).map((id) => moduleById.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
            const l = ligneById.get(d.ligneId);
            const c = l ? contratById.get(l.contratId) : undefined;
            return (
              <li key={d.id} className={`rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${d.traitee ? "opacity-60" : ""}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={REQUEST_LABEL[d.type].tone}>{REQUEST_LABEL[d.type].label}</Badge>
                      {d.type === "retour" || d.type === "devis" ? (
                        c && (
                          <Link href={`/contrats/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                            Contrat {c.reference}
                            <span className="font-normal text-slate-500">
                              {" "}
                              · {c.client || "client non renseigné"} {c.ville && `(${c.ville})`}
                            </span>
                          </Link>
                        )
                      ) : (
                        <>
                          <span className="font-semibold text-slate-900">
                            {modules.length > 1 ? `${t.P} ` : `${t.S} `}
                            {modules.map((mm, i) => (
                              <span key={mm.id}>
                                {i > 0 && ", "}
                                <Link href={`/parc/${mm.id}`} className="hover:text-brand-700">
                                  {mm.numero}
                                </Link>
                              </span>
                            ))}
                          </span>
                          {c && (
                            <Link href={`/contrats/${c.id}`} className="text-sm text-slate-500 hover:text-brand-700">
                              · {c.reference} · {c.client} {c.ville && `(${c.ville})`}
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                    {d.type === "retour" && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
                        <p className="font-semibold">
                          {t.n(modules.length)} qui sortent le {formatDate(d.dateSouhaitee)}
                        </p>
                        <p className="mt-0.5 text-amber-900">
                          {modules.map((mm, i) => (
                            <span key={mm.id}>
                              {i > 0 && " · "}
                              <Link href={`/parc/${mm.id}`} className="hover:underline">
                                {mm.numero}
                              </Link>
                              {mm.type && <span className="text-amber-700"> ({mm.type})</span>}
                            </span>
                          ))}
                        </p>
                      </div>
                    )}
                    {d.type === "devis" && (
                      <p className="text-sm text-slate-800">
                        Offre : <strong>{d.offreTitre || "—"}</strong>
                        {m && <span className="text-slate-500"> · demandé depuis {t.le} {m.numero}</span>}
                      </p>
                    )}
                    {d.type === "devis" && d.contact && <p className="text-sm text-slate-800">Contact : {d.contact}</p>}
                    {d.type === "reserve" && <p className="text-sm text-slate-800">Réception signée par {d.signataire || "le client"}, avec ces remarques :</p>}
                    {d.message && (
                      <p className={d.type === "reserve" ? "rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900" : "text-sm text-slate-700"}>{d.message}</p>
                    )}
                    <p className="text-xs text-slate-400">Reçue le {formatDateTime(d.creeeLe)}</p>
                    {d.photos.length > 0 && (
                      <div className="pt-2">
                        <PhotoGallery ids={d.photos} />
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={d.traitee ? "ghost" : "secondary"}
                    icon={d.traitee ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    onClick={() => setRequestHandled(d.id, !d.traitee)}
                  >
                    {d.traitee ? "Rouvrir" : "Marquer comme traitée"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
