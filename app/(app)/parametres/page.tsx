"use client";

import { Download, RotateCcw, Save, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Alert, Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { AppData } from "@/lib/types";

export default function ParametresPage() {
  const { data, updateSettings, resetAll, replaceAll } = useStore();
  const [nom, setNom] = useState(data.parametres.nomLoueur);
  const [inventaire, setInventaire] = useState(data.parametres.inventaire.join("\n"));
  const [delai, setDelai] = useState(data.parametres.delaiReservesJours);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const items = Array.from(new Set(inventaire.split("\n").map((s) => s.trim()).filter(Boolean)));
    if (items.length === 0) return setMessage({ tone: "red", text: "L'inventaire doit contenir au moins un élément." });
    updateSettings({ nomLoueur: nom.trim() || "Mon entreprise de location", inventaire: items, delaiReservesJours: Math.max(0, delai) });
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
    const header = ["numero", "type", "dimensions", "equipements", "depot", "statut", "contrat", "client", "ville", "date_fin"];
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
    if (!window.confirm("Effacer tout le parc, les contrats, les demandes et les photos de ce navigateur ?")) return;
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
        <Card title="Loueur et inventaire type">
          <form onSubmit={save} className="space-y-4">
            <Field label="Nom de l'entreprise de location" hint="Affiché sur les plaques QR code et sur la page client.">
              <Input value={nom} onChange={(e) => setNom(e.target.value)} />
            </Field>
            <Field label="Inventaire type d'un module" hint="Un élément par ligne. Cochés à la préparation, signés par le client, contrôlés au retour.">
              <Textarea value={inventaire} onChange={(e) => setInventaire(e.target.value)} rows={12} />
            </Field>
            <Field label="Délai de réserves du client (jours)" hint="Rappelé au client lors de la signature de la réception.">
              <Input type="number" min={0} value={delai} onChange={(e) => setDelai(Number(e.target.value) || 0)} className="w-32" />
            </Field>
            <Button type="submit" icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
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

          <Card title="Données du prototype">
            <p className="mb-4 text-sm text-slate-600">
              Dans ce prototype, les données sont enregistrées dans ce navigateur uniquement. Un autre appareil (par exemple votre téléphone) ne les voit pas. La prochaine étape est une base de données en ligne partagée.
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
