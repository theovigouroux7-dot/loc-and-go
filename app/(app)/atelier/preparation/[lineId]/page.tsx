"use client";

import clsx from "clsx";
import { CheckCircle2, Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DocumentsList } from "@/components/Documents";
import { EquipementsPicker, InventoryChecklist } from "@/components/Inventory";
import { inventaireFinal, obligatoires, optionnels } from "@/lib/inventory";
import { PhotoPicker } from "@/components/Photos";
import { SignaturePad } from "@/components/SignaturePad";
import { Scanner } from "@/components/Scanner";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Input, LineStatusBadge, PageHeader, Select } from "@/components/ui";
import { findModuleByNumero, useStore } from "@/lib/store";
import { formatDate, formatDateTime, normalizeNumero, parseScan } from "@/lib/utils";

export default function PreparationPage() {
  const { lineId } = useParams<{ lineId: string }>();
  const router = useRouter();
  const { data, assignModule, unassignModule, updatePreparation, validatePreparation } = useStore();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ moduleId: string; warning: string } | null>(null);
  const [technicien, setTechnicien] = useState("");
  const [signature, setSignature] = useState("");

  const ligne = data.lignes.find((l) => l.id === lineId);
  if (!ligne) return <EmptyState title="Ordre de préparation introuvable" action={<ButtonLink href="/atelier">Retour à l'atelier</ButtonLink>} />;

  const contrat = data.contrats.find((c) => c.id === ligne.contratId);
  const mod = ligne.moduleId ? data.modules.find((m) => m.id === ligne.moduleId) : undefined;
  const items = obligatoires(data.parametres).map((e) => e.nom);
  const prevus = ligne.equipementsPrevus ?? {};
  const catalogue = optionnels(data.parametres);
  // Les équipements prévus au contrat apparaissent en tête, même s'ils ne sont plus au catalogue.
  const options = [
    ...Object.keys(prevus).map((nom) => catalogue.find((c) => c.nom === nom) ?? { nom, obligatoire: false, quantifiable: true }),
    ...catalogue.filter((c) => !(c.nom in prevus)),
  ];
  const prep = ligne.preparation ?? { photos: [], inventaire: {}, equipements: {} };
  const final = inventaireFinal(prep, data.parametres);
  const editable = ligne.statut === "a_preparer" || ligne.statut === "en_preparation";
  const disponibles = data.modules
    .filter((m) => m.statut === "disponible")
    .sort((a, b) => {
      const ta = normalizeNumero(a.type) === normalizeNumero(ligne.typeDemande) ? 0 : 1;
      const tb = normalizeNumero(b.type) === normalizeNumero(ligne.typeDemande) ? 0 : 1;
      return ta - tb || a.numero.localeCompare(b.numero, "fr", { numeric: true });
    });

  const link = (moduleId: string) => {
    const res = assignModule(ligne.id, moduleId);
    if (!res.ok) setError(res.error);
    else {
      setError("");
      setPending(null);
    }
  };

  // Un scan propose le module ; s'il ne correspond pas au type demandé, on demande confirmation.
  const propose = (moduleId: string) => {
    setError("");
    const m = data.modules.find((x) => x.id === moduleId);
    if (!m) return setError("Module introuvable.");
    if (ligne.typeDemande && m.type && normalizeNumero(m.type) !== normalizeNumero(ligne.typeDemande)) {
      setPending({ moduleId, warning: `Le module ${m.numero} est de type « ${m.type} », le contrat demande « ${ligne.typeDemande} ».` });
      return;
    }
    link(moduleId);
  };

  const onScan = (text: string) => {
    const { moduleId, raw } = parseScan(text);
    const m = moduleId ? data.modules.find((x) => x.id === moduleId) : findModuleByNumero(data, raw);
    if (!m) return setError(`Aucun module « ${raw} » dans le parc.`);
    propose(m.id);
  };

  const validate = () => {
    const res = validatePreparation(ligne.id, { technicien, signature });
    if (!res.ok) setError(res.error);
    else router.push(`/atelier/contrat/${ligne.contratId}`);
  };

  const inventaireComplet = items.every((i) => prep.inventaire?.[i]);

  return (
    <>
      <PageHeader
        back={{ href: `/atelier/contrat/${ligne.contratId}`, label: `Contrat ${contrat?.reference ?? ""}` }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Préparation · {ligne.typeDemande || "Module"} <LineStatusBadge statut={ligne.statut} />
          </span>
        }
        description={
          contrat && (
            <>
              Contrat{" "}
              <Link href={`/contrats/${contrat.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                {contrat.reference}
              </Link>{" "}
              · {contrat.client || "—"} · {[contrat.adresse, contrat.ville].filter(Boolean).join(", ") || "chantier non renseigné"} · livraison {formatDate(ligne.dateDebut)}
            </>
          )
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="red">{error}</Alert>
        </div>
      )}

      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">À installer dans ce module (prévu au contrat)</p>
          {ligne.designation && <p className="mt-1 text-sm text-amber-900">{ligne.designation}</p>}
          {ligne.numeroPrevu && <p className="mt-1 text-sm font-medium text-amber-950">Module prévu au contrat : n° {ligne.numeroPrevu}</p>}
          {Object.keys(prevus).length === 0 ? (
            <p className="mt-2 text-sm text-amber-900">Aucun équipement particulier prévu : module nu.</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-base font-medium text-amber-950 sm:grid-cols-2">
              {Object.entries(prevus).map(([nom, q]) => (
                <li key={nom}>
                  {q} × {nom}
                </li>
              ))}
            </ul>
          )}
        </section>

        {(contrat?.documents ?? []).length > 0 && (
          <Card title="Plan et documents du contrat">
            <DocumentsList value={contrat?.documents ?? []} readOnly />
          </Card>
        )}

        <Step n={1} title="Lier un module au contrat" done={!!mod}>
          {mod ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{mod.numero}</p>
                <p className="text-sm text-slate-500">{[mod.type, mod.dimensions, mod.equipements].filter(Boolean).join(" · ")}</p>
              </div>
              {editable && (
                <Button variant="ghost" size="sm" icon={<Unlink className="h-4 w-4" />} onClick={() => unassignModule(ligne.id)}>
                  Changer de module
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {ligne.numeroPrevu && (() => {
                const prevu = findModuleByNumero(data, ligne.numeroPrevu);
                return prevu ? (
                  <Alert tone={prevu.statut === "disponible" ? "blue" : "amber"}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Le contrat prévoit le module <strong>{prevu.numero}</strong>
                        {prevu.statut !== "disponible" && " (il n'est pas disponible actuellement)"}.
                      </span>
                      {prevu.statut === "disponible" && (
                        <Button size="sm" onClick={() => propose(prevu.id)}>
                          Lier le module {prevu.numero}
                        </Button>
                      )}
                    </div>
                  </Alert>
                ) : (
                  <Alert tone="amber">Le contrat prévoit le module n° {ligne.numeroPrevu}, qui n&apos;est pas dans le parc.</Alert>
                );
              })()}
              <Scanner onResult={onScan} />
              {pending && (
                <Alert tone="amber">
                  <p>{pending.warning}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => link(pending.moduleId)}>
                      Lier quand même
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setPending(null)}>
                      Annuler
                    </Button>
                  </div>
                </Alert>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-xs text-slate-500">Ou choisir dans les modules disponibles ({disponibles.length})</p>
                  <Select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) propose(e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Sélectionner un module…</option>
                    {disponibles.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.numero} {m.type && `— ${m.type}`} {m.dimensions && `(${m.dimensions})`}
                      </option>
                    ))}
                  </Select>
                </div>
                <Link2 className="mb-2.5 h-5 w-5 text-slate-300" />
              </div>
            </div>
          )}
        </Step>

        <Step n={2} title="Photos de départ" done={prep.photos.length > 0} disabled={!mod}>
          <p className="mb-3 text-sm text-slate-600">Façades, intérieur, points sensibles. Ces photos servent de référence au retour.</p>
          <PhotoPicker value={prep.photos} onChange={(photos) => updatePreparation(ligne.id, { photos })} label="Prendre une photo" />
        </Step>

        <Step n={3} title="Équipements obligatoires" done={inventaireComplet} disabled={!mod}>
          <p className="mb-3 text-sm text-slate-600">Présents dans tous les modules : vérifiez chacun.</p>
          <InventoryChecklist items={items} value={prep.inventaire} onChange={(inventaire) => updatePreparation(ligne.id, { inventaire })} readOnly={!editable} />
        </Step>

        <Step n={4} title="Équipements du module" done={final.length > items.length} disabled={!mod}>
          <p className="mb-3 text-sm text-slate-600">
            La liste est pré-remplie avec ce que prévoit le contrat. Corrigez selon ce qui se trouve réellement dans le module : le client signera cet inventaire à la réception.
          </p>
          <EquipementsPicker
            defs={options}
            prevus={prevus}
            value={prep.equipements ?? {}}
            onChange={(equipements) => updatePreparation(ligne.id, { equipements })}
            readOnly={!editable}
          />
          <p className="mt-2 text-xs text-slate-500">
            La liste des équipements possibles se modifie dans les{" "}
            <Link href="/parametres" className="underline">
              paramètres
            </Link>
            .
          </p>
        </Step>

        {mod && final.length > 0 && (
          <Card title="Inventaire qui sera signé par le client">
            <ul className="columns-1 gap-6 text-sm text-slate-700 sm:columns-2">
              {final.map((label) => (
                <li key={label} className="py-0.5">
                  • {label}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {editable ? (
          <Step n={5} title="Signature de l'inventaire" done={!!(technicien.trim() && signature)} disabled={!mod}>
            <p className="mb-3 text-sm text-slate-600">La personne qui a préparé le module et fait l&apos;inventaire signe ici.</p>
            <div className="space-y-4">
              <Field label="Nom de la personne" required>
                <Input value={technicien} onChange={(e) => setTechnicien(e.target.value)} placeholder="Prénom Nom" autoComplete="name" />
              </Field>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">
                  Signature <span className="text-rose-600">*</span>
                </p>
                <SignaturePad onChange={setSignature} />
              </div>
            </div>
          </Step>
        ) : (
          prep.technicien && (
            <Card title="Inventaire signé">
              <p className="text-sm text-slate-700">
                Par <strong>{prep.technicien}</strong> le {formatDateTime(prep.valideeLe)}
              </p>
              {prep.signatureTechnicien && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={prep.signatureTechnicien} alt="Signature du technicien" className="mt-2 h-20 rounded bg-white ring-1 ring-slate-200" />
              )}
            </Card>
          )
        )}

        {editable && (
          <Button size="lg" className="w-full" disabled={!mod} onClick={validate} icon={<CheckCircle2 className="h-5 w-5" />}>
            Valider et signer la préparation
          </Button>
        )}
      </div>
    </>
  );
}

function Step({ n, title, done, disabled, children }: { n: number; title: string; done?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Card
      className={clsx(disabled && "pointer-events-none opacity-50")}
      title={
        <span className="flex items-center gap-3">
          <span
            className={clsx(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700",
            )}
          >
            {done ? "✓" : n}
          </span>
          {title}
        </span>
      }
    >
      {children}
    </Card>
  );
}
