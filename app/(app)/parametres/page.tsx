"use client";

import { Download, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { AvisGoogleSettings, OffresSettings } from "@/components/EspaceClientSettings";
import { Alert, Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { MODELES_METIER } from "@/lib/status";
import { type Terme, TERME_DEFAUT, termes, TERMES_PROPOSES } from "@/lib/terms";
import { useStore } from "@/lib/store";
import { remoteEnabled } from "@/lib/remote";
import type { AppData, EquipementDef } from "@/lib/types";

export default function ParametresPage() {
  const { data, updateSettings, resetAll, replaceAll } = useStore();
  const [nom, setNom] = useState(data.parametres.nomLoueur);
  const [equipements, setEquipements] = useState<EquipementDef[]>(data.parametres.equipements);
  const [nouveau, setNouveau] = useState("");
  const [nouveauCtl, setNouveauCtl] = useState("");
  const [terme, setTerme] = useState<Terme>(data.parametres.terme ?? TERME_DEFAUT);
  const [modele, setModele] = useState(MODELES_METIER[0].id);
  const [delai, setDelai] = useState(data.parametres.delaiReservesJours);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const seen = new Set<string>();
    const items = equipements
      .map((e) => ({ ...e, nom: e.nom.trim() }))
      .filter((e) => e.nom && !seen.has(e.nom.toLowerCase()) && seen.add(e.nom.toLowerCase()));
    const singulier = terme.singulier.trim().toLowerCase();
    if (!singulier) return setMessage({ tone: "red", text: "Indiquez comment vous appelez votre matériel." });
    const t: Terme = { singulier, pluriel: terme.pluriel.trim().toLowerCase() || `${singulier}s`, feminin: terme.feminin };
    setEquipements(items);
    setTerme(t);
    updateSettings({ nomLoueur: nom.trim() || "Mon entreprise de location", terme: t, equipements: items, delaiReservesJours: Math.max(0, delai) });
    setMessage({ tone: "green", text: "Paramètres enregistrés." });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loc-and-go-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const header = ["numero", "type", "caracteristiques", "equipements", "agence", "statut", "contrat", "client", "ville", "date_fin"];
    const lignes = new Map(data.lignes.map((l) => [l.id, l]));
    const contrats = new Map(data.contrats.map((c) => [c.id, c]));
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = data.modules.map((m) => {
      const l = m.ligneId ? lignes.get(m.ligneId) : undefined;
      const c = l ? contrats.get(l.contratId) : undefined;
      return [m.numero, m.type, m.dimensions, m.equipements, m.depot, m.statut, c?.reference ?? "", c?.client ?? "", c?.ville ?? "", l?.dateFin ?? ""].map(esc).join(";");
    });
    const blob = new Blob(["﻿" + [header.join(";"), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loc-and-go-parc-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (!Array.isArray(parsed.modules) || !Array.isArray(parsed.lignes)) throw new Error("format");
      replaceAll(parsed);
      setMessage({ tone: "green", text: "Sauvegarde restaurée (les photos ne font pas partie de la sauvegarde)." });
    } catch {
      setMessage({ tone: "red", text: "Ce fichier n'est pas une sauvegarde Loc and Go valide." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const reset = async () => {
    if (!window.confirm(remoteEnabled ? "Effacer tout le parc, les contrats, les demandes et les photos de la base en ligne, pour tous les utilisateurs ?" : "Effacer tout le parc, les contrats, les demandes et les photos de ce navigateur ?")) return;
    await resetAll();
    setNom("Mon entreprise de location");
    setMessage({ tone: "green", text: "Toutes les données ont été effacées." });
  };

  return (
    <>
      <PageHeader title="Paramètres" />
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Loueur et vocabulaire">
          <form onSubmit={save} className="space-y-5">
            <Field label="Nom de l'entreprise de location" hint="Affiché sur les plaques QR code et sur la page client.">
              <Input value={nom} onChange={(e) => setNom(e.target.value)} />
            </Field>

            <Field label="Comment appelez-vous votre matériel ?" hint="Ce mot est repris partout : parc, contrats, atelier, plaques et page client.">
              <Select
                value={TERMES_PROPOSES.findIndex((x) => x.singulier === terme.singulier) >= 0 ? terme.singulier : "__autre"}
                onChange={(e) => {
                  const choisi = TERMES_PROPOSES.find((x) => x.singulier === e.target.value);
                  setTerme(choisi ?? { singulier: "", pluriel: "", feminin: false });
                }}
              >
                {TERMES_PROPOSES.map((x) => (
                  <option key={x.singulier} value={x.singulier}>
                    {x.singulier.charAt(0).toUpperCase() + x.singulier.slice(1)}
                  </option>
                ))}
                <option value="__autre">Autre…</option>
              </Select>
            </Field>
            {TERMES_PROPOSES.findIndex((x) => x.singulier === terme.singulier) < 0 && (
              <div className="grid grid-cols-3 gap-2">
                <Field label="Au singulier">
                  <Input value={terme.singulier} onChange={(e) => setTerme({ ...terme, singulier: e.target.value })} placeholder="ex. échafaudage" />
                </Field>
                <Field label="Au pluriel">
                  <Input value={terme.pluriel} onChange={(e) => setTerme({ ...terme, pluriel: e.target.value })} placeholder="ex. échafaudages" />
                </Field>
                <Field label="Genre">
                  <Select value={terme.feminin ? "f" : "m"} onChange={(e) => setTerme({ ...terme, feminin: e.target.value === "f" })}>
                    <option value="m">un</option>
                    <option value="f">une</option>
                  </Select>
                </Field>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-sm font-medium text-slate-700">Partir d&apos;un modèle</p>
              <p className="mb-2 text-xs text-slate-500">Remplit les points de contrôle et les éléments fournis typiques d&apos;un métier. Vous ajustez ensuite.</p>
              <div className="flex flex-wrap gap-2">
                <Select value={modele} onChange={(e) => setModele(e.target.value)} className="min-w-[220px] flex-1">
                  {MODELES_METIER.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const m = MODELES_METIER.find((x) => x.id === modele);
                    if (!m) return;
                    if (equipements.length && !window.confirm("Remplacer les listes actuelles par ce modèle ?")) return;
                    setEquipements(m.equipements.map((x) => ({ ...x })));
                    setMessage({ tone: "green", text: `Modèle « ${m.nom} » chargé : vérifiez les listes puis enregistrez.` });
                  }}
                >
                  Charger le modèle
                </Button>
              </div>
            </div>

            {(
              [
                {
                  obligatoire: true,
                  titre: "Points de contrôle",
                  aide: `Vérifiés par l'atelier sur chaque ${termes(terme).s} avant le départ et au retour (ex. propreté, niveaux, VGP à jour, extincteur).`,
                  placeholder: "Nouveau point de contrôle",
                },
                {
                  obligatoire: false,
                  titre: "Éléments fournis (optionnels)",
                  aide: "Accessoires ou mobilier que l'atelier ajoute selon le contrat. « À l'unité » : il indique la quantité.",
                  placeholder: "Nouvel élément fourni",
                },
              ] as const
            ).map((section) => {
              const items = equipements.map((e, i) => ({ e, i })).filter(({ e }) => e.obligatoire === section.obligatoire);
              const saisie = section.obligatoire ? nouveauCtl : nouveau;
              const setSaisie = section.obligatoire ? setNouveauCtl : setNouveau;
              return (
                <div key={section.titre}>
                  <p className="mb-1 text-sm font-medium text-slate-700">{section.titre}</p>
                  <p className="mb-2 text-xs text-slate-500">{section.aide}</p>
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
                      À configurer : ajoutez vos éléments ci-dessous ou chargez un modèle.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                      {items.map(({ e, i }) => (
                        <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2">
                          <Input
                            value={e.nom}
                            onChange={(ev) => setEquipements(equipements.map((x, j) => (j === i ? { ...x, nom: ev.target.value } : x)))}
                            className="min-w-[160px] flex-1"
                            aria-label="Nom"
                          />
                          {!section.obligatoire && (
                            <label className="flex items-center gap-1.5 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={e.quantifiable}
                                onChange={(ev) => setEquipements(equipements.map((x, j) => (j === i ? { ...x, quantifiable: ev.target.checked } : x)))}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              À l&apos;unité
                            </label>
                          )}
                          <button
                            type="button"
                            onClick={() => setEquipements(equipements.filter((_, j) => j !== i))}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={section.placeholder} aria-label={section.placeholder} />
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<Plus className="h-4 w-4" />}
                      disabled={!saisie.trim()}
                      onClick={() => {
                        setEquipements([...equipements, { nom: saisie.trim(), obligatoire: section.obligatoire, quantifiable: !section.obligatoire }]);
                        setSaisie("");
                      }}
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              );
            })}
            <Field label="Délai de réserves du client (jours)" hint="Rappelé au client lors de la signature de la réception.">
              <div className="w-32">
                <Input type="number" min={0} value={delai} onChange={(e) => setDelai(Number(e.target.value) || 0)} />
              </div>
            </Field>
            <Button type="submit" icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <OffresSettings />
          <AvisGoogleSettings />

          <Card title="Exports">
            <p className="mb-4 text-sm text-slate-600">L&apos;export CSV se réimporte dans votre logiciel de gestion ou dans Excel.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
                Exporter le parc (CSV)
              </Button>
              <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportData}>
                Sauvegarde complète (JSON)
              </Button>
              <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                Restaurer une sauvegarde
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
            </div>
          </Card>

          <Card title="Données">
            <p className="mb-4 text-sm text-slate-600">
              {remoteEnabled
                ? "Les données sont enregistrées dans la base en ligne : tous les appareils (bureau, atelier, téléphones des clients) voient le même parc. « Tout effacer » vide la base pour tout le monde."
                : "Les données sont enregistrées dans ce navigateur uniquement : un autre appareil ne les voit pas. Branchez la base en ligne (voir le guide du dépôt) pour partager le parc entre le bureau, l'atelier et les clients."}
            </p>
            <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={reset}>
              Tout effacer
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
