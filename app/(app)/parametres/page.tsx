"use client";

import { Download, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { AvisGoogleSettings, OffresSettings } from "@/components/EspaceClientSettings";
import { Alert, Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
import { remoteEnabled } from "@/lib/remote";
import type { AppData, EquipementDef } from "@/lib/types";

export default function ParametresPage() {
  const { data, updateSettings, resetAll, replaceAll } = useStore();
  const [nom, setNom] = useState(data.parametres.nomLoueur);
  const [equipements, setEquipements] = useState<EquipementDef[]>(data.parametres.equipements);
  const [nouveau, setNouveau] = useState("");
  const [delai, setDelai] = useState(data.parametres.delaiReservesJours);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const seen = new Set<string>();
    const items = equipements
      .map((e) => ({ ...e, nom: e.nom.trim() }))
      .filter((e) => e.nom && !seen.has(e.nom.toLowerCase()) && seen.add(e.nom.toLowerCase()));
    if (items.length === 0) return setMessage({ tone: "red", text: "La liste des équipements doit contenir au moins un élément." });
    setEquipements(items);
    updateSettings({ nomLoueur: nom.trim() || "Mon entreprise de location", equipements: items, delaiReservesJours: Math.max(0, delai) });
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
    const header = ["numero", "type", "dimensions", "equipements", "agence", "statut", "contrat", "client", "ville", "date_fin"];
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
        <Card title="Loueur et équipements">
          <form onSubmit={save} className="space-y-4">
            <Field label="Nom de l'entreprise de location" hint="Affiché sur les plaques QR code et sur la page client.">
              <Input value={nom} onChange={(e) => setNom(e.target.value)} />
            </Field>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Équipements possibles dans un module</p>
              <p className="mb-3 text-xs text-slate-500">
                Obligatoire : présent dans tous les modules, l&apos;atelier le vérifie. Sinon, le chef d&apos;atelier choisit à la préparation s&apos;il est dans le module. « À l&apos;unité » : il indique la quantité (tables, chaises…).
              </p>
              <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                {equipements.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <Input
                      value={e.nom}
                      onChange={(ev) => setEquipements(equipements.map((x, j) => (j === i ? { ...x, nom: ev.target.value } : x)))}
                      className="min-w-[160px] flex-1"
                      aria-label="Nom de l'équipement"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={e.obligatoire}
                        onChange={(ev) => setEquipements(equipements.map((x, j) => (j === i ? { ...x, obligatoire: ev.target.checked, quantifiable: ev.target.checked ? false : x.quantifiable } : x)))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Obligatoire
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={e.quantifiable}
                        disabled={e.obligatoire}
                        onChange={(ev) => setEquipements(equipements.map((x, j) => (j === i ? { ...x, quantifiable: ev.target.checked } : x)))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      À l&apos;unité
                    </label>
                    <button
                      type="button"
                      onClick={() => setEquipements(equipements.filter((_, j) => j !== i))}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Supprimer l'équipement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Input value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder="Nouvel équipement (ex. Fontaine à eau)" />
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Plus className="h-4 w-4" />}
                  disabled={!nouveau.trim()}
                  onClick={() => {
                    setEquipements([...equipements, { nom: nouveau.trim(), obligatoire: false, quantifiable: false }]);
                    setNouveau("");
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </div>
            <Field label="Délai de réserves du client (jours)" hint="Rappelé au client lors de la signature de la réception.">
              <Input type="number" min={0} value={delai} onChange={(e) => setDelai(Number(e.target.value) || 0)} className="w-32" />
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
