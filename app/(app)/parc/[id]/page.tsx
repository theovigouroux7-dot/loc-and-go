"use client";

import { ExternalLink, Hammer, Pencil, Printer, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoGallery } from "@/components/Photos";
import { QrCode } from "@/components/QrCode";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Input, LineStatusBadge, ModuleStatusBadge, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
import { formatDate, formatDateTime, moduleUrl } from "@/lib/utils";

export default function ModulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, updateModule, deleteModule, startRepair, finishRepair } = useStore();
  const mod = data.modules.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ numero: "", type: "", dimensions: "", equipements: "", depot: "" });
  const [error, setError] = useState("");

  if (!mod) {
    return <EmptyState title="Module introuvable" action={<ButtonLink href="/parc">Retour au parc</ButtonLink>} />;
  }

  const ligne = mod.ligneId ? data.lignes.find((l) => l.id === mod.ligneId) : undefined;
  const contrat = ligne ? data.contrats.find((c) => c.id === ligne.contratId) : undefined;
  const lignesDuModule = data.lignes.filter((l) => l.moduleId === mod.id);
  const historique = data.historique.filter((e) => e.moduleId === mod.id);
  const url = moduleUrl(mod.id);

  const startEdit = () => {
    setForm({ numero: mod.numero, type: mod.type, dimensions: mod.dimensions, equipements: mod.equipements, depot: mod.depot });
    setError("");
    setEditing(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updateModule(mod.id, form);
    if (res.ok) setEditing(false);
    else setError(res.error);
  };

  const remove = () => {
    if (!window.confirm(`Supprimer définitivement le module ${mod.numero} ?`)) return;
    const res = deleteModule(mod.id);
    if (res.ok) router.push("/parc");
    else setError(res.error);
  };

  return (
    <>
      <PageHeader
        back={{ href: "/parc", label: "Parc de modules" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Module {mod.numero} <ModuleStatusBadge statut={mod.statut} />
          </span>
        }
        description={[mod.type, mod.dimensions, mod.depot && `Dépôt ${mod.depot}`].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {mod.statut === "a_remettre" && (
              <Button variant="secondary" icon={<Hammer className="h-4 w-4" />} onClick={() => startRepair(mod.id)}>
                Démarrer la réparation
              </Button>
            )}
            {(mod.statut === "reparation" || mod.statut === "a_remettre") && (
              <Button variant="success" icon={<Wrench className="h-4 w-4" />} onClick={() => finishRepair(mod.id)}>
                Valider la réparation
              </Button>
            )}
            {!editing && (
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={startEdit}>
                Modifier
              </Button>
            )}
          </>
        }
      />

      {error && !editing && (
        <div className="mb-4">
          <Alert tone="red">{error}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {editing ? (
            <Card title="Modifier la fiche">
              <form onSubmit={save} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Numéro" required>
                    <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                  </Field>
                  <Field label="Type">
                    <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
                  </Field>
                  <Field label="Dimensions">
                    <Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} />
                  </Field>
                  <Field label="Dépôt">
                    <Input value={form.depot} onChange={(e) => setForm({ ...form, depot: e.target.value })} />
                  </Field>
                  <Field label="Équipements">
                    <Input value={form.equipements} onChange={(e) => setForm({ ...form, equipements: e.target.value })} />
                  </Field>
                </div>
                {error && <Alert tone="red">{error}</Alert>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Enregistrer</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                    Annuler
                  </Button>
                  {mod.statut === "disponible" && (
                    <Button type="button" variant="ghost" className="ml-auto text-rose-600" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>
                      Supprimer le module
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          ) : (
            <Card title="Fiche du module">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Info label="Numéro" value={mod.numero} />
                <Info label="Type" value={mod.type} />
                <Info label="Dimensions" value={mod.dimensions} />
                <Info label="Dépôt" value={mod.depot} />
                <Info label="Équipements" value={mod.equipements} />
                <Info label="Ajouté le" value={formatDate(mod.creeLe)} />
              </dl>
            </Card>
          )}

          <Card title="Contrat en cours">
            {contrat && ligne ? (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/contrats/${contrat.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                    {contrat.reference} · {contrat.client || "Client non renseigné"}
                  </Link>
                  <LineStatusBadge statut={ligne.statut} />
                </div>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Info label="Chantier" value={[contrat.adresse, contrat.ville].filter(Boolean).join(", ")} />
                  <Info label="Livraison" value={formatDate(ligne.dateDebut)} />
                  <Info label="Fin prévue" value={formatDate(ligne.dateFin)} />
                </dl>
                {ligne.statut === "a_preparer" || ligne.statut === "en_preparation" ? (
                  <ButtonLink href={`/atelier/preparation/${ligne.id}`} size="sm">
                    Ouvrir la préparation
                  </ButtonLink>
                ) : null}
                {ligne.statut === "retournee" && (
                  <ButtonLink href={`/atelier/constat/${ligne.id}`} size="sm">
                    Faire le constat de retour
                  </ButtonLink>
                )}
                {ligne.preparation && ligne.preparation.photos.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Photos de départ</p>
                    <PhotoGallery ids={ligne.preparation.photos} />
                  </div>
                )}
                {ligne.reception ? (
                  <p className="text-emerald-700">
                    Réception signée par {ligne.reception.nom} le {formatDateTime(ligne.reception.signeeLe)}
                    {ligne.reception.reserves ? " — avec réserves" : " — sans réserve"}
                  </p>
                ) : (
                  ["en_cours", "prete"].includes(ligne.statut) && <p className="text-amber-700">Réception pas encore signée par le client.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Ce module n&apos;est rattaché à aucun contrat.</p>
            )}
          </Card>

          <Card title="Historique du module">
            {historique.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun événement.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {historique.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                    <p className="text-slate-800">{e.message}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(e.date)}</p>
                  </li>
                ))}
              </ol>
            )}
            {lignesDuModule.length > 1 && (
              <p className="mt-4 text-xs text-slate-500">{lignesDuModule.length} locations au total pour ce module.</p>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="QR code">
            <div className="flex flex-col items-center gap-3 text-center">
              <QrCode value={url} size={180} />
              <p className="text-lg font-semibold tracking-wide">{mod.numero}</p>
              <p className="break-all text-xs text-slate-400">{url}</p>
              <div className="flex w-full flex-col gap-2">
                <ButtonLink href={`/m/${mod.id}`} variant="secondary" size="sm" icon={<ExternalLink className="h-4 w-4" />}>
                  Ouvrir la vue client
                </ButtonLink>
                <ButtonLink href={`/parc/plaques?ids=${mod.id}`} variant="ghost" size="sm" icon={<Printer className="h-4 w-4" />}>
                  Imprimer la plaque
                </ButtonLink>
              </div>
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
      <dd className="mt-0.5 text-slate-900">{value || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}
