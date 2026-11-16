"use client";

import clsx from "clsx";
import { CheckCircle2, Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { EquipementsPicker, InventoryChecklist } from "@/components/Inventory";
import { inventaireFinal, obligatoires, optionnels } from "@/lib/inventory";
import { PhotoPicker } from "@/components/Photos";
import { Scanner } from "@/components/Scanner";
import { Alert, Button, ButtonLink, Card, EmptyState, LineStatusBadge, PageHeader, Select } from "@/components/ui";
import { findModuleByNumero, useStore } from "@/lib/store";
import { formatDate, normalizeNumero, parseScan } from "@/lib/utils";

export default function PreparationPage() {
  const { lineId } = useParams<{ lineId: string }>();
  const router = useRouter();
  const { data, assignModule, unassignModule, updatePreparation, validatePreparation } = useStore();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ moduleId: string; warning: string } | null>(null);

  const ligne = data.lignes.find((l) => l.id === lineId);
  if (!ligne) return <EmptyState title="Ordre de préparation introuvable" action={<ButtonLink href="/atelier">Retour à l'atelier</ButtonLink>} />;

  const contrat = data.contrats.find((c) => c.id === ligne.contratId);
  const mod = ligne.moduleId ? data.modules.find((m) => m.id === ligne.moduleId) : undefined;
  const items = obligatoires(data.parametres).map((e) => e.nom);
  const options = optionnels(data.parametres);
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
    const res = validatePreparation(ligne.id);
    if (!res.ok) setError(res.error);
    else router.push("/atelier");
  };

  const inventaireComplet = items.every((i) => prep.inventaire?.[i]);

  return (
    <>
      <PageHeader
        back={{ href: "/atelier", label: "Atelier" }}
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
            Cochez ce qui se trouve réellement dans ce module et indiquez les quantités. Le client signera cet inventaire à la réception.
          </p>
          <EquipementsPicker
            defs={options}
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

        {editable && (
          <Button size="lg" className="w-full" disabled={!mod} onClick={validate} icon={<CheckCircle2 className="h-5 w-5" />}>
            Valider la préparation
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
