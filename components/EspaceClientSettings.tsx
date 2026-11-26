"use client";

import clsx from "clsx";
import { Eye, EyeOff, Plus, Save, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Offre } from "@/lib/types";
import { uid } from "@/lib/utils";
import { PhotoPicker } from "./Photos";
import { Alert, Button, Card, Field, Input, Textarea } from "./ui";

/** Réglage du lien d'avis Google affiché dans l'espace client. */
export function AvisGoogleSettings() {
  const { data, updateSettings } = useStore();
  const [actif, setActif] = useState(data.parametres.avisGoogle.actif);
  const [lien, setLien] = useState(data.parametres.avisGoogle.lien);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const url = lien.trim();
    if (actif && !/^https?:\/\//i.test(url)) {
      return setMessage({ tone: "red", text: "Collez le lien complet, qui commence par https://" });
    }
    updateSettings({ avisGoogle: { actif, lien: url } });
    setMessage({ tone: "green", text: actif ? "Le bloc « Laissez-nous un avis » est affiché dans l'espace client." : "Le bloc d'avis est masqué." });
  };

  return (
    <Card title="Avis Google">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-600">
          Affiche dans l&apos;espace client un bouton qui ouvre votre page d&apos;avis Google. Le lien se trouve dans votre fiche Google Business Profile, rubrique « Demander des avis ».
        </p>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="h-5 w-5 rounded border-slate-300" />
          Afficher la demande d&apos;avis aux clients
        </label>
        <Field label="Lien vers votre page d'avis Google">
          <Input value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://g.page/r/…/review" />
        </Field>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" icon={<Save className="h-4 w-4" />}>
          Enregistrer
        </Button>
      </form>
    </Card>
  );
}

/** Offres présentées aux clients, chacune avec un bouton « Demander un devis ». */
export function OffresSettings() {
  const { data, updateSettings } = useStore();
  const [offres, setOffres] = useState<Offre[]>(data.parametres.offres);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const set = (id: string, patch: Partial<Offre>) => setOffres(offres.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const save = () => {
    const valides = offres.map((o) => ({ ...o, titre: o.titre.trim(), description: o.description.trim() })).filter((o) => o.titre);
    setOffres(valides);
    updateSettings({ offres: valides });
    const visibles = valides.filter((o) => o.actif).length;
    setMessage({ tone: "green", text: `${visibles} offre(s) visible(s) dans l'espace client.` });
  };

  return (
    <Card title="Offres et demandes de devis">
      <p className="mb-4 text-sm text-slate-600">
        Chaque offre active apparaît dans l&apos;espace client avec sa photo, sa description et un bouton « Demander un devis ». Les demandes arrivent dans Demandes clients.
      </p>
      {offres.length === 0 && (
        <p className="mb-4 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
          À configurer : ajoutez les prestations que vous proposez à vos clients (nettoyage, carburant, formation…).
        </p>
      )}
      <ul className="space-y-4">
        {offres.map((o) => (
          <li key={o.id} className={clsx("rounded-xl p-4 ring-1", o.actif ? "bg-white ring-emerald-300" : "bg-slate-50 ring-slate-200")}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => set(o.id, { actif: !o.actif })}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                  o.actif ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-white text-slate-500 ring-slate-300",
                )}
              >
                {o.actif ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {o.actif ? "Visible par les clients" : "Masquée"}
              </button>
              <button
                type="button"
                onClick={() => setOffres(offres.filter((x) => x.id !== o.id))}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Supprimer l'offre"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">Photo</p>
                <PhotoPicker
                  value={o.photo ? [o.photo] : []}
                  onChange={(ids) => set(o.id, { photo: ids.length ? ids[ids.length - 1] : undefined })}
                  label={o.photo ? "Changer" : "Ajouter une photo"}
                />
              </div>
              <Field label="Titre">
                <Input value={o.titre} onChange={(e) => set(o.id, { titre: e.target.value })} placeholder="ex. Nettoyage, carburant, formation…" />
              </Field>
              <Field label="Description">
                <Textarea
                  value={o.description}
                  onChange={(e) => set(o.id, { description: e.target.value })}
                  placeholder="Décrivez la prestation proposée à vos clients pendant la location."
                />
              </Field>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setOffres([...offres, { id: uid("offre"), titre: "", description: "", actif: true }])}
        >
          Ajouter une offre
        </Button>
        <Button type="button" icon={<Save className="h-4 w-4" />} onClick={save}>
          Enregistrer les offres
        </Button>
      </div>
      {message && (
        <div className="mt-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
    </Card>
  );
}

export function StarRow() {
  return (
    <span className="flex gap-0.5 text-amber-400">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className="h-5 w-5 fill-current" />
      ))}
    </span>
  );
}
