"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ContractAnalyzer } from "@/components/ContractAnalyzer";
import { AccessoiresEditor } from "@/components/Accessoires";
import { DocumentsList } from "@/components/Documents";
import { LineRequestsEditor } from "@/components/LineRequestsEditor";
import { Alert, Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { type LineRequest, useStore, useTermes } from "@/lib/store";
import type { ContractAccessoire, ContractDocument } from "@/lib/types";
import { normalizeNumero, today } from "@/lib/utils";

export default function NouveauContratPage() {
  const t = useTermes();
  const { data, createContract } = useStore();
  const router = useRouter();
  const [form, setForm] = useState({ reference: "", client: "", adresse: "", ville: "", dateLivraison: today(), dateFin: "", notes: "" });
  const [demandes, setDemandes] = useState<LineRequest[]>([{ type: "", quantite: 1, equipements: {} }]);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [accessoires, setAccessoires] = useState<ContractAccessoire[]>([]);

  const types = useMemo(() => Array.from(new Set(data.modules.map((m) => m.type).filter(Boolean))).sort(), [data.modules]);
  const disponibles = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of data.modules) if (m.statut === "disponible") map[m.type] = (map[m.type] ?? 0) + 1;
    return map;
  }, [data.modules]);
  const total = demandes.reduce((s, d) => s + d.quantite, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.reference.trim()) return setError("La référence du contrat est obligatoire.");
    if (data.contrats.some((c) => normalizeNumero(c.reference) === normalizeNumero(form.reference))) {
      return setError(`Un contrat ${form.reference.trim()} existe déjà.`);
    }
    if (!form.dateLivraison) return setError("La date de livraison est obligatoire.");
    if (form.dateFin && form.dateFin < form.dateLivraison) return setError("La date de fin est antérieure à la livraison.");
    const lignes = demandes.filter((d) => d.quantite > 0);
    if (lignes.length === 0 || total === 0) return setError(`Indiquez au moins ${t.un}.`);
    const id = createContract({ ...form, documents, accessoires }, lignes);
    router.push(`/contrats/${id}`);
  };

  return (
    <>
      <PageHeader
        back={{ href: "/contrats", label: "Contrats" }}
        title="Nouveau contrat"
        description={`Indiquez les types et le nombre ${t.deP}. Les numéros précis seront affectés par l'atelier, au scan, pendant la préparation.`}
      />
      <ContractAnalyzer
        catalogue={data.parametres.equipements.filter((e) => !e.obligatoire).map((e) => e.nom)}
        types={types}
        onResult={(f, d, doc) => {
          const { accessoires: acc, documents: _docs, ...champs } = f;
          void _docs;
          setForm((prev) => ({ ...prev, ...champs }));
          if (acc?.length) setAccessoires(acc);
          if (d.length > 0) setDemandes(d);
          if (doc) setDocuments((prev) => [...prev.filter((x) => x.type !== "contrat"), doc]);
          setError("");
        }}
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <Card title="Contrat et chantier">
          <div className="space-y-4">
            <Field label="Référence du contrat" required>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="LOC-2026-0142" autoFocus />
            </Field>
            <Field label="Client">
              <Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Nom de l'entreprise" />
            </Field>
            <Field label="Adresse du chantier">
              <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} placeholder="12 rue de l'Industrie" />
            </Field>
            <Field label="Ville">
              <Input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Lyon" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date de livraison" required hint={`Une fois passée, ${t.les} prêts passent en location.`}>
                <Input type="date" value={form.dateLivraison} onChange={(e) => setForm({ ...form, dateLivraison: e.target.value })} />
              </Field>
              <Field label="Date de fin prévue">
                <Input type="date" value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Accès chantier, grutage, contact sur place…" />
            </Field>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={`${t.P} demandés (${total})`}>
            <LineRequestsEditor value={demandes} onChange={setDemandes} types={types} disponibles={disponibles} catalogue={data.parametres.equipements.filter((e) => !e.obligatoire).map((e) => e.nom)} />
          </Card>
          <Card title="Accessoires (rampes PMR, escaliers…)">
            <p className="mb-3 text-sm text-slate-600">Matériel livré en plus, hors parc. L&apos;atelier le cochera quand il sera prêt.</p>
            <AccessoiresEditor value={accessoires} onChange={setAccessoires} />
          </Card>

          <Card title="Plan et documents">
            <p className="mb-3 text-sm text-slate-600">Plan d&apos;implantation, plan d&apos;aménagement ou photo du chantier : l&apos;atelier les verra en préparant {t.les}.</p>
            <DocumentsList value={documents} onChange={setDocuments} />
          </Card>
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" icon={<CheckCircle2 className="h-5 w-5" />}>
            Enregistrer et envoyer à l&apos;atelier
          </Button>
        </div>
      </form>
    </>
  );
}
