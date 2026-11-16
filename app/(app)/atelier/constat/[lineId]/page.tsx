"use client";

import clsx from "clsx";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { InventoryChecklist } from "@/components/Inventory";
import { PhotoGallery, PhotoPicker } from "@/components/Photos";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, PageHeader, Textarea } from "@/components/ui";
import { inventaireReference } from "@/lib/inventory";
import { useStore } from "@/lib/store";
import type { InventaireCoche } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function ConstatPage() {
  const { lineId } = useParams<{ lineId: string }>();
  const router = useRouter();
  const { data, saveConstat } = useStore();
  const ligne = data.lignes.find((l) => l.id === lineId);
  const [inventaire, setInventaire] = useState<InventaireCoche>({});
  const [degats, setDegats] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [intact, setIntact] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  if (!ligne) return <EmptyState title="Retour introuvable" action={<ButtonLink href="/atelier">Retour à l'atelier</ButtonLink>} />;

  const mod = data.modules.find((m) => m.id === ligne.moduleId);
  const contrat = data.contrats.find((c) => c.id === ligne.contratId);
  // Référence : l'inventaire signé à la réception, sinon celui de la préparation, sinon la liste type.
  const reference = inventaireReference(ligne, data.parametres);
  const items = reference.length ? reference : data.parametres.equipements.filter((e) => e.obligatoire).map((e) => e.nom);
  const manquants = items.filter((i) => !inventaire[i]);

  if (ligne.constat) {
    return (
      <>
        <PageHeader back={{ href: "/atelier", label: "Atelier" }} title={`Constat du module ${mod?.numero ?? ""}`} />
        <Alert tone="green">Constat déjà enregistré le {formatDateTime(ligne.constat.faitLe)}.</Alert>
        <div className="mt-4">
          <ButtonLink href={`/parc/${mod?.id}`}>Voir le module</ButtonLink>
        </div>
      </>
    );
  }

  const submit = () => {
    if (intact === null) return setError("Indiquez si le module revient intact ou abîmé.");
    if (!intact && !degats.trim() && manquants.length === 0) return setError("Décrivez les dégâts constatés.");
    saveConstat(ligne.id, { inventaire, degats: degats.trim(), photos, intact });
    router.push(intact ? "/atelier" : `/parc/${mod?.id}`);
  };

  return (
    <>
      <PageHeader
        back={{ href: "/atelier", label: "Atelier" }}
        title={`Constat de retour · ${mod?.numero ?? ""}`}
        description={
          contrat && (
            <>
              Contrat{" "}
              <Link href={`/contrats/${contrat.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                {contrat.reference}
              </Link>{" "}
              · {contrat.client || "—"} · {contrat.ville || "—"}
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Au départ">
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Photos de l&apos;atelier</p>
                <PhotoGallery ids={ligne.preparation?.photos ?? []} empty="Aucune photo de départ (module repris à l'import)." />
              </div>
              {ligne.reception ? (
                <div className="space-y-3">
                  <p className="text-emerald-700">
                    Réception signée par <strong>{ligne.reception.nom}</strong> le {formatDateTime(ligne.reception.signeeLe)}.
                  </p>
                  {ligne.reception.reserves && (
                    <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
                      <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Réserves du client</p>
                      <p className="mt-1 text-amber-900">{ligne.reception.reserves}</p>
                    </div>
                  )}
                  {ligne.reception.photos.length > 0 && <PhotoGallery ids={ligne.reception.photos} />}
                  <InventoryChecklist items={Object.keys(ligne.reception.inventaire)} value={ligne.reception.inventaire} readOnly />
                  {ligne.reception.signature && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ligne.reception.signature} alt="Signature du client" className="h-20 rounded bg-white ring-1 ring-slate-200" />
                  )}
                </div>
              ) : (
                <Alert tone="amber">Le client n&apos;a pas signé la réception de ce module.</Alert>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Au retour : matériel présent">
            <InventoryChecklist items={items} value={inventaire} onChange={setInventaire} uncheckedTone="alert" />
            {manquants.length > 0 && Object.keys(inventaire).length > 0 && (
              <p className="mt-2 text-sm text-rose-700">{manquants.length} élément(s) non coché(s) seront notés comme manquants.</p>
            )}
          </Card>

          <Card title="État du module">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIntact(true)}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-xl p-4 text-sm font-medium ring-2 transition",
                  intact === true ? "bg-emerald-50 text-emerald-800 ring-emerald-500" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300",
                )}
              >
                <CheckCircle2 className="h-6 w-6" /> Intact
                <span className="text-xs font-normal text-slate-500">Remis disponible</span>
              </button>
              <button
                type="button"
                onClick={() => setIntact(false)}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-xl p-4 text-sm font-medium ring-2 transition",
                  intact === false ? "bg-rose-50 text-rose-800 ring-rose-500" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300",
                )}
              >
                <TriangleAlert className="h-6 w-6" /> Abîmé
                <span className="text-xs font-normal text-slate-500">À remettre en état</span>
              </button>
            </div>
            {intact === false && (
              <div className="space-y-4">
                <Field label="Dégâts constatés">
                  <Textarea value={degats} onChange={(e) => setDegats(e.target.value)} placeholder="Vitre fendue côté porte, trou dans la cloison…" />
                </Field>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Photos des dégâts</p>
                  <PhotoPicker value={photos} onChange={setPhotos} label="Photo des dégâts" />
                </div>
              </div>
            )}
          </Card>

          {error && <Alert tone="red">{error}</Alert>}
          <Button size="lg" className="w-full" onClick={submit} icon={<CheckCircle2 className="h-5 w-5" />}>
            Enregistrer le constat
          </Button>
        </div>
      </div>
    </>
  );
}
