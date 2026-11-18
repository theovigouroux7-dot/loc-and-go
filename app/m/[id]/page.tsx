"use client";

import clsx from "clsx";
import { CalendarCheck, CheckCircle2, ChevronDown, ClipboardCheck, ExternalLink, FileText, LifeBuoy, PackageCheck, ScanLine, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StarRow } from "@/components/EspaceClientSettings";
import { loadPhoto } from "@/lib/photos";
import { PhotoGallery, PhotoPicker } from "@/components/Photos";
import { SignaturePad } from "@/components/SignaturePad";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { inventaireFinal } from "@/lib/inventory";
import { useStore } from "@/lib/store";
import type { AppData, ContractLine, InventaireCoche, Module, Offre } from "@/lib/types";
import { addDays, formatDate, formatDateTime, today } from "@/lib/utils";

type Panel = "reception" | "sav" | "retour" | "devis" | null;

interface LigneClient {
  ligne: ContractLine;
  module: Module;
}

/** Modules du contrat visibles par le client : ceux qui sont partis du dépôt et pas encore revenus. */
function lignesDuContrat(data: AppData, contratId: string): LigneClient[] {
  return data.lignes
    .filter((l) => l.contratId === contratId && ["prete", "en_cours", "retour_demande"].includes(l.statut) && l.moduleId)
    .map((l) => ({ ligne: l, module: data.modules.find((m) => m.id === l.moduleId)! }))
    .filter((x) => x.module)
    .sort((a, b) => a.module.numero.localeCompare(b.module.numero, "fr", { numeric: true }));
}

export default function ClientModulePage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useStore();
  const [panel, setPanel] = useState<Panel>(null);
  const [offre, setOffre] = useState<Offre | null>(null);
  const [done, setDone] = useState("");

  const scanned = data.modules.find((m) => m.id === id);
  const ligneScannee = scanned?.ligneId ? data.lignes.find((l) => l.id === scanned.ligneId) : undefined;
  const contrat = ligneScannee ? data.contrats.find((c) => c.id === ligneScannee.contratId) : undefined;
  const lignes = contrat ? lignesDuContrat(data, contrat.id) : [];
  const aSigner = lignes.filter((x) => !x.ligne.reception);
  // Le client sur place peut demander le retour dès que le module est parti du dépôt, même avant la date prévue de livraison.
  const enLocation = lignes.filter((x) => x.ligne.statut === "en_cours" || x.ligne.statut === "prete");
  const close = (message: string) => {
    setPanel(null);
    setDone(message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-brand-700 px-5 pb-10 pt-6 text-white">
        <p className="text-xs font-medium uppercase tracking-widest text-brand-100">{data.parametres.nomLoueur}</p>
        {contrat ? (
          <>
            <h1 className="mt-2 text-2xl font-bold">Votre location</h1>
            <p className="text-sm text-brand-100">
              Contrat {contrat.reference}
              {contrat.client && ` · ${contrat.client}`}
            </p>
          </>
        ) : (
          <h1 className="mt-2 text-2xl font-bold">{scanned ? `Module ${scanned.numero}` : "Module inconnu"}</h1>
        )}
      </header>

      <main className="mx-auto -mt-6 max-w-xl space-y-4 px-4 pb-10">
        {!scanned ? (
          <Box>
            <p className="text-sm text-slate-700">Ce QR code ne correspond à aucun module. Contactez votre loueur.</p>
          </Box>
        ) : !contrat || lignes.length === 0 ? (
          <Box>
            <p className="text-sm text-slate-700">Ce module est actuellement au dépôt du loueur. Il n&apos;est rattaché à aucune location en cours.</p>
          </Box>
        ) : (
          <>
            {done && <Alert tone="green">{done}</Alert>}

            <Box>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Livraison</dt>
                  <dd className="text-slate-900">{formatDate(contrat.dateLivraison || ligneScannee?.dateDebut)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Fin prévue</dt>
                  <dd className="text-slate-900">{formatDate(contrat.dateFin)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">Chantier</dt>
                  <dd className="text-slate-900">{[contrat.adresse, contrat.ville].filter(Boolean).join(", ") || "—"}</dd>
                </div>
              </dl>
            </Box>

            {aSigner.length > 0 && panel !== "reception" && (
              <button onClick={() => setPanel("reception")} className="flex w-full items-center gap-4 rounded-2xl bg-brand-600 p-5 text-left text-white shadow-lg">
                <ClipboardCheck className="h-8 w-8 flex-none" />
                <span>
                  <span className="block font-semibold">Contrôler et signer la réception</span>
                  <span className="block text-sm text-brand-100">
                    {aSigner.length} module(s), une seule signature
                  </span>
                </span>
              </button>
            )}

            {panel === "reception" && (
              <ReceptionForm
                lignes={aSigner}
                scannedId={scanned.id}
                onCancel={() => setPanel(null)}
                onDone={(n) => close(`Merci, la réception de ${n} module(s) est signée. Votre loueur en est informé.`)}
              />
            )}

            {panel === null && (
              <div className="grid grid-cols-2 gap-3">
                <ActionTile icon={<LifeBuoy className="h-6 w-6" />} title="Signaler un problème" subtitle="Demande de SAV" onClick={() => setPanel("sav")} />
                <ActionTile
                  icon={<Undo2 className="h-6 w-6" />}
                  title="Demander un retour"
                  subtitle={enLocation.length ? "Un ou plusieurs modules" : "Aucun module à rendre"}
                  onClick={() => setPanel("retour")}
                  disabled={enLocation.length === 0}
                />
              </div>
            )}

            {panel === "sav" && (
              <SavForm lignes={lignes} defaultModuleId={scanned.id} onCancel={() => setPanel(null)} onDone={() => close("Votre demande de SAV est envoyée. Le loueur vous recontacte.")} />
            )}
            {panel === "retour" && (
              <RetourForm
                lignes={enLocation}
                defaultModuleId={scanned.id}
                onCancel={() => setPanel(null)}
                onDone={(n, date) => close(`Votre demande de retour de ${n} module(s) pour le ${formatDate(date)} est envoyée.`)}
              />
            )}

            {panel === "devis" && offre && (
              <DevisForm
                offre={offre}
                moduleId={scanned.id}
                onCancel={() => setPanel(null)}
                onDone={() => close(`Votre demande de devis « ${offre.titre} » est envoyée. Le loueur vous recontacte rapidement.`)}
              />
            )}

            <Box>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Modules de votre location ({lignes.length})</p>
              <ul className="divide-y divide-slate-100">
                {lignes.map(({ ligne, module }) => (
                  <ModuleRow key={ligne.id} ligne={ligne} module={module} scanned={module.id === scanned.id} />
                ))}
              </ul>
            </Box>

            {panel === null && data.parametres.offres.some((o) => o.actif && o.titre) && (
              <section className="space-y-3">
                <p className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Nos services</p>
                {data.parametres.offres
                  .filter((o) => o.actif && o.titre)
                  .map((o) => (
                    <OffreCard
                      key={o.id}
                      offre={o}
                      onDevis={() => {
                        setOffre(o);
                        setPanel("devis");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  ))}
              </section>
            )}

            {data.parametres.avisGoogle.actif && data.parametres.avisGoogle.lien && (
              <section className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
                <div className="flex justify-center">
                  <StarRow />
                </div>
                <p className="mt-2 font-semibold text-slate-900">Votre avis compte</p>
                <p className="mt-1 text-sm text-slate-600">Satisfait de {data.parametres.nomLoueur} ? Laissez-nous un avis sur Google, ça ne prend qu&apos;une minute.</p>
                <a
                  href={data.parametres.avisGoogle.lien}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
                >
                  Laisser un avis Google <ExternalLink className="h-4 w-4" />
                </a>
              </section>
            )}
          </>
        )}

        <p className="pt-4 text-center text-xs text-slate-400">
          Propulsé par Loc and Go ·{" "}
          <Link href="/" className="underline">
            espace loueur
          </Link>
        </p>
      </main>
    </div>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">{children}</section>;
}

function ActionTile({ icon, title, subtitle, onClick, disabled }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx("flex flex-col items-start gap-2 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition", disabled ? "opacity-50" : "hover:ring-brand-500")}
    >
      <span className="text-brand-600">{icon}</span>
      <span className="text-sm font-semibold text-slate-900">{title}</span>
      <span className="text-xs text-slate-500">{subtitle}</span>
    </button>
  );
}

function ModuleRow({ ligne, module, scanned }: { ligne: ContractLine; module: Module; scanned: boolean }) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const inventaire = inventaireFinal(ligne.preparation, data.parametres);
  return (
    <li className="py-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            {module.numero}
            {scanned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                <ScanLine className="h-3 w-3" /> scanné
              </span>
            )}
          </span>
          <span className="block text-xs text-slate-500">{[module.type, module.dimensions].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex items-center gap-2">
          {ligne.statut === "retour_demande" ? (
            <span className="text-xs font-medium text-amber-700">Retour le {formatDate(ligne.dateRetourSouhaitee)}</span>
          ) : ligne.reception ? (
            <span className="text-xs font-medium text-emerald-700">Réception signée</span>
          ) : (
            <span className="text-xs font-medium text-amber-700">À signer</span>
          )}
          <ChevronDown className={clsx("h-4 w-4 text-slate-400 transition", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {inventaire.length > 0 && (
            <ul className="rounded-lg bg-slate-50 p-3 text-slate-700">
              {inventaire.map((label) => (
                <li key={label}>• {label}</li>
              ))}
            </ul>
          )}
          {ligne.preparation?.technicien && (
            <p className="text-xs text-slate-500">
              Inventaire de départ signé par {ligne.preparation.technicien} ({data.parametres.nomLoueur}) le {formatDateTime(ligne.preparation.valideeLe)}
            </p>
          )}
          {ligne.reception && (
            <p className="text-xs text-slate-500">
              Réception signée par {ligne.reception.nom} le {formatDateTime(ligne.reception.signeeLe)} · {ligne.reception.reserves ? "avec réserves" : "sans réserve"}
            </p>
          )}
          {ligne.preparation && ligne.preparation.photos.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-slate-500">Photos au départ du dépôt</p>
              <PhotoGallery ids={ligne.preparation.photos} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ReceptionForm({
  lignes,
  scannedId,
  onCancel,
  onDone,
}: {
  lignes: LigneClient[];
  scannedId: string;
  onCancel: () => void;
  onDone: (n: number) => void;
}) {
  const { data, signReceptions } = useStore();
  const [selection, setSelection] = useState<string[]>(lignes.map((x) => x.ligne.id));
  const [reserves, setReserves] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [nom, setNom] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const delai = data.parametres.delaiReservesJours;
  const itemsOf = (l: ContractLine) => inventaireFinal(l.preparation, data.parametres);

  const submit = () => {
    if (selection.length === 0) return setError("Sélectionnez au moins un module.");
    if (!nom.trim()) return setError("Indiquez votre nom.");
    if (!signature) return setError("Signez dans le cadre prévu.");
    // Le client signe l'inventaire tel qu'il est listé ; ce qui manque est indiqué dans les remarques.
    const inventaires: Record<string, InventaireCoche> = {};
    for (const { ligne } of lignes) {
      if (selection.includes(ligne.id)) inventaires[ligne.id] = Object.fromEntries(itemsOf(ligne).map((i) => [i, true]));
    }
    signReceptions(selection, { inventaires, reserves: reserves.trim(), photos, nom: nom.trim(), signature });
    onDone(selection.length);
  };

  return (
    <Box>
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <PackageCheck className="h-5 w-5 text-brand-600" /> Réception des modules
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        Voici le matériel livré, module par module. Si quelque chose manque ou est abîmé, indiquez-le dans les remarques, puis signez une seule fois pour tous les modules.
      </p>

      <ul className="mb-5 space-y-2">
        {lignes.map(({ ligne, module }) => {
          const items = itemsOf(ligne);
          const checked = selection.includes(ligne.id);
          return (
            <li key={ligne.id} className={clsx("rounded-xl p-3 ring-1", checked ? "ring-slate-200" : "opacity-50 ring-slate-100")}>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setSelection(e.target.checked ? [...selection, ligne.id] : selection.filter((s) => s !== ligne.id))}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300"
                  aria-label={`Inclure le module ${module.numero}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    {module.numero}
                    {module.id === scannedId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                        <ScanLine className="h-3 w-3" /> scanné
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">{module.type || "Module"}</span>
                  <span className="mt-1.5 block text-sm text-slate-700">
                    {items.length === 0 ? <span className="text-slate-400">Pas d&apos;inventaire détaillé</span> : items.join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="space-y-5">
        <Field label="Remarques : matériel manquant ou abîmé" hint={`Précisez le module concerné. Sans remarque sous ${delai} jour(s), les modules sont réputés conformes aux photos de départ.`}>
          <Textarea value={reserves} onChange={(e) => setReserves(e.target.value)} placeholder="Ex. : BAT-002, il manque une chaise ; rayure sur la porte…" />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Photos (facultatif)</p>
          <PhotoPicker value={photos} onChange={setPhotos} />
        </div>
        <Field label="Votre nom" required>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" autoComplete="name" />
        </Field>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">
            Signature <span className="text-rose-600">*</span>
          </p>
          <SignaturePad onChange={setSignature} />
        </div>
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={submit} icon={<CheckCircle2 className="h-5 w-5" />}>
            Signer pour {selection.length} module(s)
          </Button>
          <Button size="lg" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>
    </Box>
  );
}

function SavForm({ lignes, defaultModuleId, onCancel, onDone }: { lignes: LigneClient[]; defaultModuleId: string; onCancel: () => void; onDone: () => void }) {
  const { createRequest } = useStore();
  const [moduleId, setModuleId] = useState(defaultModuleId);
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");

  const submit = () => {
    if (!message.trim()) return setError("Décrivez le problème.");
    const res = createRequest({ type: "sav", moduleId, message, photos });
    if (!res.ok) return setError(res.error);
    onDone();
  };

  return (
    <Box>
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
        <LifeBuoy className="h-5 w-5 text-brand-600" /> Signaler un problème
      </h2>
      <div className="space-y-4">
        <Field label="Module concerné">
          <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {lignes.map(({ module }) => (
              <option key={module.id} value={module.id}>
                {module.numero} {module.type && `— ${module.type}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quel est le problème ?" required>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="La climatisation ne démarre plus…" />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Photos (facultatif)</p>
          <PhotoPicker value={photos} onChange={setPhotos} />
        </div>
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={submit}>
            Envoyer la demande
          </Button>
          <Button size="lg" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>
    </Box>
  );
}

function RetourForm({
  lignes,
  defaultModuleId,
  onCancel,
  onDone,
}: {
  lignes: LigneClient[];
  defaultModuleId: string;
  onCancel: () => void;
  onDone: (n: number, date: string) => void;
}) {
  const { requestReturn } = useStore();
  const minDate = today();
  const [selection, setSelection] = useState<string[]>(
    lignes.some((x) => x.module.id === defaultModuleId) ? [defaultModuleId] : lignes.map((x) => x.module.id),
  );
  const [date, setDate] = useState(addDays(minDate, 7));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (selection.length === 0) return setError("Sélectionnez au moins un module.");
    if (!date) return setError("Choisissez une date.");
    const res = requestReturn(selection, date, message);
    if (!res.ok) return setError(res.error);
    onDone(selection.length, date);
  };

  return (
    <Box>
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
        <CalendarCheck className="h-5 w-5 text-brand-600" /> Demander un retour
      </h2>
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Modules à rendre</p>
            <button
              type="button"
              className="text-xs font-medium text-brand-600"
              onClick={() => setSelection(selection.length === lignes.length ? [] : lignes.map((x) => x.module.id))}
            >
              {selection.length === lignes.length ? "Tout décocher" : "Tout sélectionner"}
            </button>
          </div>
          <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            {lignes.map(({ module }) => (
              <li key={module.id}>
                <label className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selection.includes(module.id)}
                    onChange={(e) => setSelection(e.target.checked ? [...selection, module.id] : selection.filter((s) => s !== module.id))}
                    className="h-5 w-5 rounded border-slate-300"
                  />
                  <span className="font-medium text-slate-900">{module.numero}</span>
                  <span className="text-slate-500">{module.type}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <Field label="Date d'enlèvement souhaitée" required>
          <Input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Précisions (facultatif)">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Accès, horaires, contact sur place…" />
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={submit}>
            Demander le retour de {selection.length} module(s)
          </Button>
          <Button size="lg" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>
    </Box>
  );
}

function OffreCard({ offre, onDevis }: { offre: Offre; onDevis: () => void }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    if (offre.photo)
      loadPhoto(offre.photo).then((p) => {
        if (!cancelled) setSrc(p);
      });
    return () => {
      cancelled = true;
    };
  }, [offre.photo]);

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={offre.titre} className="h-44 w-full object-cover" />
      )}
      <div className="p-5">
        <h3 className="font-semibold text-slate-900">{offre.titre}</h3>
        {offre.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{offre.description}</p>}
        <Button className="mt-4" icon={<FileText className="h-4 w-4" />} onClick={onDevis}>
          Demander un devis
        </Button>
      </div>
    </article>
  );
}

function DevisForm({ offre, moduleId, onCancel, onDone }: { offre: Offre; moduleId: string; onCancel: () => void; onDone: () => void }) {
  const { createRequest } = useStore();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!contact.trim()) return setError("Indiquez votre nom et un téléphone ou un e-mail pour qu'on vous recontacte.");
    const res = createRequest({ type: "devis", moduleId, message, photos: [], offreId: offre.id, offreTitre: offre.titre, contact });
    if (!res.ok) return setError(res.error);
    onDone();
  };

  return (
    <Box>
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <FileText className="h-5 w-5 text-brand-600" /> Demande de devis
      </h2>
      <p className="mb-4 text-sm text-slate-600">{offre.titre}</p>
      <div className="space-y-4">
        <Field label="Votre besoin" hint="Fréquence, nombre de modules, date souhaitée…">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. : nettoyage une fois par semaine des 4 modules bureaux" />
        </Field>
        <Field label="Vos coordonnées" required>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nom, téléphone ou e-mail" autoComplete="name" />
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={submit}>
            Envoyer la demande
          </Button>
          <Button size="lg" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>
    </Box>
  );
}
