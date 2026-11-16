"use client";

import clsx from "clsx";
import { CalendarCheck, CheckCircle2, ClipboardCheck, LifeBuoy, PackageCheck, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { InventoryChecklist } from "@/components/Inventory";
import { PhotoGallery, PhotoPicker } from "@/components/Photos";
import { SignaturePad } from "@/components/SignaturePad";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { InventaireCoche } from "@/lib/types";
import { addDays, formatDate, formatDateTime, today } from "@/lib/utils";

type Panel = "reception" | "sav" | "retour" | null;

export default function ClientModulePage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useStore();
  const [panel, setPanel] = useState<Panel>(null);
  const [done, setDone] = useState("");

  const mod = data.modules.find((m) => m.id === id);
  const ligne = mod?.ligneId ? data.lignes.find((l) => l.id === mod.ligneId) : undefined;
  const contrat = ligne ? data.contrats.find((c) => c.id === ligne.contratId) : undefined;
  const chezClient = !!ligne && ["prete", "en_cours", "retour_demande"].includes(ligne.statut);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-brand-700 px-5 pb-10 pt-6 text-white">
        <p className="text-xs font-medium uppercase tracking-widest text-brand-100">{data.parametres.nomLoueur}</p>
        {mod ? (
          <>
            <h1 className="mt-2 text-2xl font-bold">Module {mod.numero}</h1>
            <p className="text-sm text-brand-100">{[mod.type, mod.dimensions].filter(Boolean).join(" · ") || "Module de location"}</p>
          </>
        ) : (
          <h1 className="mt-2 text-2xl font-bold">Module inconnu</h1>
        )}
      </header>

      <main className="-mt-6 space-y-4 px-4 pb-10">
        {!mod ? (
          <Box>
            <p className="text-sm text-slate-700">Ce QR code ne correspond à aucun module. Contactez votre loueur.</p>
          </Box>
        ) : !chezClient || !ligne ? (
          <Box>
            <p className="text-sm text-slate-700">Ce module est actuellement au dépôt du loueur. Il n&apos;est rattaché à aucune location en cours.</p>
          </Box>
        ) : (
          <>
            {done && <Alert tone="green">{done}</Alert>}

            <Box>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Votre location</p>
              <p className="mt-1 font-semibold text-slate-900">
                Contrat {contrat?.reference} {contrat?.client && `· ${contrat.client}`}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Livraison</dt>
                  <dd className="text-slate-900">{formatDate(ligne.dateDebut)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Fin prévue</dt>
                  <dd className="text-slate-900">{formatDate(ligne.dateFin)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">Chantier</dt>
                  <dd className="text-slate-900">{[contrat?.adresse, contrat?.ville].filter(Boolean).join(", ") || "—"}</dd>
                </div>
              </dl>
              {ligne.statut === "retour_demande" && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Retour demandé pour le {formatDate(ligne.dateRetourSouhaitee)}.
                </p>
              )}
            </Box>

            {ligne.reception ? (
              <Box>
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Réception signée par {ligne.reception.nom}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  le {formatDateTime(ligne.reception.signeeLe)} · {ligne.reception.reserves ? "avec réserves" : "sans réserve"}
                </p>
              </Box>
            ) : (
              panel !== "reception" && (
                <button
                  onClick={() => setPanel("reception")}
                  className="flex w-full items-center gap-4 rounded-2xl bg-brand-600 p-5 text-left text-white shadow-lg"
                >
                  <ClipboardCheck className="h-8 w-8 flex-none" />
                  <span>
                    <span className="block font-semibold">Contrôler et signer la réception</span>
                    <span className="block text-sm text-brand-100">Vérifiez l&apos;état et l&apos;inventaire du module</span>
                  </span>
                </button>
              )
            )}

            {panel === "reception" && !ligne.reception && (
              <ReceptionForm
                lineId={ligne.id}
                onCancel={() => setPanel(null)}
                onDone={() => {
                  setPanel(null);
                  setDone("Merci, la réception est signée. Votre loueur en est informé.");
                }}
              />
            )}

            {panel === null && (
              <div className="grid grid-cols-2 gap-3">
                <ActionTile icon={<LifeBuoy className="h-6 w-6" />} title="Signaler un problème" subtitle="Demande de SAV" onClick={() => setPanel("sav")} />
                <ActionTile
                  icon={<Undo2 className="h-6 w-6" />}
                  title="Demander le retour"
                  subtitle={ligne.statut === "retour_demande" ? "Déjà demandé" : "Enlèvement du module"}
                  onClick={() => setPanel("retour")}
                  disabled={ligne.statut !== "en_cours"}
                />
              </div>
            )}

            {panel === "sav" && (
              <SavForm
                moduleId={mod.id}
                onCancel={() => setPanel(null)}
                onDone={() => {
                  setPanel(null);
                  setDone("Votre demande de SAV est envoyée. Le loueur vous recontacte.");
                }}
              />
            )}
            {panel === "retour" && (
              <RetourForm
                moduleId={mod.id}
                minDate={today()}
                onCancel={() => setPanel(null)}
                onDone={(date) => {
                  setPanel(null);
                  setDone(`Votre demande de retour pour le ${formatDate(date)} est envoyée.`);
                }}
              />
            )}

            {ligne.preparation && ligne.preparation.photos.length > 0 && (
              <Box>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Photos au départ du dépôt</p>
                <PhotoGallery ids={ligne.preparation.photos} />
              </Box>
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
      className={clsx(
        "flex flex-col items-start gap-2 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition",
        disabled ? "opacity-50" : "hover:ring-brand-500",
      )}
    >
      <span className="text-brand-600">{icon}</span>
      <span className="text-sm font-semibold text-slate-900">{title}</span>
      <span className="text-xs text-slate-500">{subtitle}</span>
    </button>
  );
}

function ReceptionForm({ lineId, onCancel, onDone }: { lineId: string; onCancel: () => void; onDone: () => void }) {
  const { data, signReception } = useStore();
  const ligne = data.lignes.find((l) => l.id === lineId);
  const items = Object.keys(ligne?.preparation?.inventaire ?? {}).length ? Object.keys(ligne!.preparation!.inventaire) : data.parametres.inventaire;
  const [inventaire, setInventaire] = useState<InventaireCoche>({});
  const [reserves, setReserves] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [nom, setNom] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const manquants = items.filter((i) => !inventaire[i]);
  const delai = data.parametres.delaiReservesJours;

  const submit = () => {
    if (!nom.trim()) return setError("Indiquez votre nom.");
    if (!signature) return setError("Signez dans le cadre prévu.");
    if (manquants.length > 0 && !reserves.trim()) {
      return setError("Certains éléments ne sont pas cochés : précisez-le dans les réserves, ou cochez-les s'ils sont présents.");
    }
    signReception(lineId, { inventaire, reserves: reserves.trim(), photos, nom: nom.trim(), signature });
    onDone();
  };

  return (
    <Box>
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <PackageCheck className="h-5 w-5 text-brand-600" /> Réception du module
      </h2>
      <p className="mb-4 text-sm text-slate-600">Cochez chaque élément présent et en bon état. Ce document fait foi en cas de dégâts au retour.</p>
      <div className="space-y-5">
        <InventoryChecklist items={items} value={inventaire} onChange={setInventaire} uncheckedTone="alert" />
        <Field label="Réserves" hint={`Sans réserve sous ${delai} jour(s), le module est réputé conforme aux photos de départ.`}>
          <Textarea value={reserves} onChange={(e) => setReserves(e.target.value)} placeholder="Ex. : rayure sur la porte, télécommande absente…" />
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
            Signer la réception
          </Button>
          <Button size="lg" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>
    </Box>
  );
}

function SavForm({ moduleId, onCancel, onDone }: { moduleId: string; onCancel: () => void; onDone: () => void }) {
  const { createRequest } = useStore();
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

function RetourForm({ moduleId, minDate, onCancel, onDone }: { moduleId: string; minDate: string; onCancel: () => void; onDone: (date: string) => void }) {
  const { createRequest } = useStore();
  const [date, setDate] = useState(addDays(minDate, 7));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!date) return setError("Choisissez une date.");
    const res = createRequest({ type: "retour", moduleId, message, dateSouhaitee: date, photos: [] });
    if (!res.ok) return setError(res.error);
    onDone(date);
  };

  return (
    <Box>
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
        <CalendarCheck className="h-5 w-5 text-brand-600" /> Demander le retour du module
      </h2>
      <div className="space-y-4">
        <Field label="Date d'enlèvement souhaitée" required>
          <Input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Précisions (facultatif)">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Accès, horaires, contact sur place…" />
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
