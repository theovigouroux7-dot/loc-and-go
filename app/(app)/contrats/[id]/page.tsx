"use client";

import { CalendarClock, Pencil, Plus, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { LineRequestsEditor } from "@/components/LineRequestsEditor";
import { PhotoGallery } from "@/components/Photos";
import { inventaireFinal } from "@/lib/inventory";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Input, LineStatusBadge, PageHeader, Table, Td, Textarea, Th } from "@/components/ui";
import { type LineRequest, useStore } from "@/lib/store";
import { formatDate, formatDateTime, today } from "@/lib/utils";

export default function ContratPage() {
  const { id } = useParams<{ id: string }>();
  const { data, updateContract, addLines, setLineDateFin, setContractDateFin, unassignModule, requestReturn } = useStore();
  const contrat = data.contrats.find((c) => c.id === id);
  const lignes = useMemo(() => data.lignes.filter((l) => l.contratId === id), [data.lignes, id]);
  const moduleById = useMemo(() => new Map(data.modules.map((m) => [m.id, m])), [data.modules]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ client: "", adresse: "", ville: "", dateLivraison: "", dateFin: "", notes: "" });
  const [ajout, setAjout] = useState<LineRequest[] | null>(null);
  const [prolongation, setProlongation] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [dateRetour, setDateRetour] = useState(today());
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const types = useMemo(() => Array.from(new Set(data.modules.map((m) => m.type).filter(Boolean))).sort(), [data.modules]);
  const disponibles = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of data.modules) if (m.statut === "disponible") map[m.type] = (map[m.type] ?? 0) + 1;
    return map;
  }, [data.modules]);

  if (!contrat) return <EmptyState title="Contrat introuvable" action={<ButtonLink href="/contrats">Retour aux contrats</ButtonLink>} />;

  const historique = data.historique.filter((e) => e.contratId === contrat.id);
  const enLocation = lignes.filter((l) => l.statut === "en_cours");

  const startEdit = () => {
    setForm({
      client: contrat.client,
      adresse: contrat.adresse,
      ville: contrat.ville,
      dateLivraison: contrat.dateLivraison,
      dateFin: contrat.dateFin,
      notes: contrat.notes,
    });
    setEditing(true);
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateContract(contrat.id, form);
    setEditing(false);
  };

  const saveAjout = () => {
    if (!ajout) return;
    const valid = ajout.filter((r) => r.quantite > 0);
    addLines(contrat.id, valid);
    setAjout(null);
    setMessage({ tone: "green", text: "Modules ajoutés : de nouveaux ordres de préparation sont envoyés à l'atelier." });
  };

  const saveProlongation = () => {
    if (!prolongation) return;
    setContractDateFin(contrat.id, prolongation);
    setProlongation("");
    setMessage({ tone: "green", text: `Contrat prolongé jusqu'au ${formatDate(prolongation)}.` });
  };

  const demanderRetour = () => {
    const moduleIds = selection.map((id) => lignes.find((x) => x.id === id)?.moduleId).filter((x): x is string => !!x);
    const res = requestReturn(moduleIds, dateRetour, "Retour demandé par le bureau");
    setMessage(
      res.ok
        ? { tone: "green", text: `Retour demandé pour ${moduleIds.length} module(s) le ${formatDate(dateRetour)}.` }
        : { tone: "red", text: res.error },
    );
    if (res.ok) setSelection([]);
  };

  // Modules qui sortent du chantier, regroupés par date de retour.
  const retoursPrevus = Array.from(
    lignes
      .filter((l) => l.statut === "retour_demande")
      .reduce((map, l) => {
        const k = l.dateRetourSouhaitee || "";
        return map.set(k, [...(map.get(k) ?? []), l]);
      }, new Map<string, typeof lignes>()),
  ).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <>
      <PageHeader
        back={{ href: "/contrats", label: "Contrats" }}
        title={`Contrat ${contrat.reference}`}
        description={[contrat.client, contrat.ville].filter(Boolean).join(" · ") || undefined}
        actions={
          !editing && (
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={startEdit}>
              Modifier
            </Button>
          )
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {retoursPrevus.length > 0 && (
            <Card title="Modules qui sortent du chantier">
              <ul className="space-y-3">
                {retoursPrevus.map(([date, ls]) => (
                  <li key={date} className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
                    <p className="font-semibold text-amber-950">
                      {ls.length} module(s) à récupérer le {formatDate(date)}
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      {ls
                        .map((l) => {
                          const m = l.moduleId ? moduleById.get(l.moduleId) : undefined;
                          return [m?.numero, l.typeDemande].filter(Boolean).join(" · ");
                        })
                        .join("  —  ")}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title={`Lignes du contrat (${lignes.length})`}
            actions={
              !ajout && (
                <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setAjout([{ type: "", quantite: 1, equipements: {} }])}>
                  Ajouter des modules
                </Button>
              )
            }
          >
            {ajout && (
              <div className="mb-5 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="mb-3 text-sm font-medium text-slate-900">Ajouter des modules au contrat</p>
                <LineRequestsEditor value={ajout} onChange={setAjout} types={types} disponibles={disponibles} catalogue={data.parametres.equipements.filter((e) => !e.obligatoire).map((e) => e.nom)} />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={saveAjout}>
                    Ajouter
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAjout(null)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {lignes.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune ligne.</p>
            ) : (
              <div className="-mx-5 -mb-5">
                <Table>
                  <thead>
                    <tr>
                      <Th className="w-8" />
                      <Th>Module</Th>
                      <Th>Type</Th>
                      <Th>Livraison</Th>
                      <Th>Fin</Th>
                      <Th>Statut</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lignes.map((l) => {
                      const m = l.moduleId ? moduleById.get(l.moduleId) : undefined;
                      const selectable = l.statut === "en_cours";
                      return (
                        <tr key={l.id}>
                          <Td>
                            {selectable && (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300"
                                checked={selection.includes(l.id)}
                                onChange={(e) => setSelection(e.target.checked ? [...selection, l.id] : selection.filter((s) => s !== l.id))}
                                aria-label="Sélectionner pour un retour"
                              />
                            )}
                          </Td>
                          <Td>
                            {m ? (
                              <Link href={`/parc/${m.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                                {m.numero}
                              </Link>
                            ) : (
                              <span className="text-slate-400">Non affecté</span>
                            )}
                          </Td>
                          <Td className="whitespace-normal">
                            {l.typeDemande || "—"}
                            {l.equipementsPrevus && Object.keys(l.equipementsPrevus).length > 0 && (
                              <p className="mt-0.5 max-w-[220px] text-xs text-slate-500">
                                {Object.entries(l.equipementsPrevus)
                                  .map(([nom, q]) => `${q} ${nom}`)
                                  .join(" · ")}
                              </p>
                            )}
                          </Td>
                          <Td>{formatDate(l.dateDebut)}</Td>
                          <Td>
                            {l.statut === "cloturee" ? (
                              formatDate(l.dateFin)
                            ) : (
                              <input
                                type="date"
                                value={l.dateFin}
                                onChange={(e) => setLineDateFin(l.id, e.target.value)}
                                className="rounded border-0 bg-transparent p-0 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500"
                                aria-label="Date de fin de la ligne"
                              />
                            )}
                          </Td>
                          <Td>
                            <LineStatusBadge statut={l.statut} />
                            {l.statut === "retour_demande" && <p className="mt-1 text-xs text-slate-500">le {formatDate(l.dateRetourSouhaitee)}</p>}
                            {l.reception && <p className="mt-1 text-xs text-emerald-700">Réception signée</p>}
                          </Td>
                          <Td className="text-right">
                            {(l.statut === "a_preparer" || l.statut === "en_preparation") && (
                              <Link href={`/atelier/preparation/${l.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                                Préparer
                              </Link>
                            )}
                            {l.statut === "prete" && (
                              <button onClick={() => unassignModule(l.id)} className="text-sm text-slate-500 hover:text-rose-600">
                                Détacher
                              </button>
                            )}
                            {l.statut === "retournee" && (
                              <Link href={`/atelier/constat/${l.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                                Constat
                              </Link>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>

          {lignes.some((l) => l.preparation?.photos.length) && (
            <Card title="État des modules au départ">
              <ul className="space-y-5">
                {lignes
                  .filter((l) => l.moduleId && l.preparation)
                  .map((l) => {
                    const m = moduleById.get(l.moduleId!);
                    const inventaire = inventaireFinal(l.preparation, data.parametres);
                    return (
                      <li key={l.id}>
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <Link href={`/parc/${m?.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                            {m?.numero}
                          </Link>
                          <span className="text-xs text-slate-500">
                            {l.preparation?.valideeLe
                              ? `Inventaire signé${l.preparation.technicien ? ` par ${l.preparation.technicien}` : ""} le ${formatDateTime(l.preparation.valideeLe)}`
                              : "Préparation en cours"}
                          </span>
                        </div>
                        <PhotoGallery ids={l.preparation?.photos ?? []} empty="Pas encore de photo." />
                        {inventaire.length > 0 && <p className="mt-2 text-xs text-slate-500">{inventaire.join(" · ")}</p>}
                        {l.reception?.photos.length ? (
                          <div className="mt-3">
                            <p className="mb-1 text-xs font-medium text-amber-800">Photos jointes par le client à la réception</p>
                            <PhotoGallery ids={l.reception.photos} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            </Card>
          )}

          {enLocation.length > 0 && (
            <Card title="Retour de modules">
              <p className="mb-3 text-sm text-slate-600">
                Cochez les modules à rapatrier dans le tableau ci-dessus (retour total ou partiel), puis choisissez la date. La demande s&apos;affiche sur le tableau de bord et à l&apos;atelier.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Date de retour souhaitée">
                  <Input type="date" value={dateRetour} onChange={(e) => setDateRetour(e.target.value)} />
                </Field>
                <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} disabled={selection.length === 0} onClick={demanderRetour}>
                  Demander le retour de {selection.length} module(s)
                </Button>
                {selection.length < enLocation.length && (
                  <button className="pb-2 text-sm text-brand-600 hover:text-brand-700" onClick={() => setSelection(enLocation.map((l) => l.id))}>
                    Tout sélectionner
                  </button>
                )}
              </div>
            </Card>
          )}

          <Card title="Historique du contrat">
            {historique.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun événement.</p>
            ) : (
              <ul className="space-y-2.5">
                {historique.map((e) => {
                  const m = e.moduleId ? moduleById.get(e.moduleId) : undefined;
                  return (
                    <li key={e.id} className="flex gap-3 text-sm">
                      <span className="w-36 flex-none text-xs text-slate-400">{formatDateTime(e.date)}</span>
                      <span className="text-slate-700">
                        {m && <strong className="font-medium text-slate-900">{m.numero} — </strong>}
                        {e.message}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {editing ? (
            <Card title="Modifier le contrat">
              <form onSubmit={saveEdit} className="space-y-4">
                <Field label="Client">
                  <Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
                </Field>
                <Field label="Adresse du chantier">
                  <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
                </Field>
                <Field label="Ville">
                  <Input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
                </Field>
                <Field label="Date de livraison" hint="S'applique aux modules pas encore livrés.">
                  <Input type="date" value={form.dateLivraison} onChange={(e) => setForm({ ...form, dateLivraison: e.target.value })} />
                </Field>
                <Field label="Notes">
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit">Enregistrer</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card title="Informations">
              <dl className="space-y-3 text-sm">
                <Info label="Client" value={contrat.client} />
                <Info label="Chantier" value={[contrat.adresse, contrat.ville].filter(Boolean).join(", ")} />
                <Info label="Livraison" value={formatDate(contrat.dateLivraison)} />
                <Info label="Fin prévue" value={formatDate(contrat.dateFin)} />
                {contrat.notes && <Info label="Notes" value={contrat.notes} />}
              </dl>
            </Card>
          )}

          <Card title="Prolonger le contrat">
            <p className="mb-3 text-sm text-slate-600">Nouvelle date de fin pour tous les modules encore sur place. Pour un seul module, modifiez sa date dans le tableau.</p>
            <div className="flex gap-2">
              <Input type="date" value={prolongation} min={contrat.dateFin || undefined} onChange={(e) => setProlongation(e.target.value)} />
              <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} disabled={!prolongation} onClick={saveProlongation}>
                Prolonger
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-slate-900">{value || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}
