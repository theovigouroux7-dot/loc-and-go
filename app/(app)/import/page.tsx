"use client";

import clsx from "clsx";
import { CheckCircle2, Download, FileSpreadsheet, ListPlus, PenLine, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { type ImportResult, type ImportRow, useStore } from "@/lib/store";
import { formatDate, normalizeNumero, parseLooseDate } from "@/lib/utils";

type Tab = "fichier" | "liste" | "manuel";

// Champs reconnus à l'import, dans l'ordre de détection automatique des colonnes.
const FIELDS: { key: keyof ImportRow; label: string; hint: string; keywords: string[] }[] = [
  { key: "contrat", label: "N° de contrat", hint: "si le module est déjà loué", keywords: ["contrat", "n loc", "num loc", "numero loc", "location", "bon"] },
  { key: "client", label: "Client", hint: "facultatif", keywords: ["client", "locataire", "societe"] },
  { key: "ville", label: "Ville du chantier", hint: "facultatif", keywords: ["ville", "chantier", "commune", "adresse"] },
  { key: "dateFin", label: "Date de fin", hint: "facultatif", keywords: ["date fin", "fin", "echeance", "retour"] },
  { key: "depot", label: "Agence", hint: "facultatif", keywords: ["agence", "depot", "site", "emplacement"] },
  { key: "dimensions", label: "Dimensions", hint: "facultatif", keywords: ["dimension", "taille", "longueur", "surface"] },
  { key: "equipements", label: "Équipements", hint: "facultatif", keywords: ["equipement", "option", "amenagement"] },
  { key: "type", label: "Type de module", hint: "recommandé", keywords: ["type", "modele", "designation", "famille", "categorie"] },
  { key: "numero", label: "Numéro du module", hint: "obligatoire", keywords: ["numero", "n parc", "num", "module", "parc", "immat", "serie", "id"] },
];

const DISPLAY_ORDER: (keyof ImportRow)[] = ["numero", "type", "dimensions", "equipements", "depot", "contrat", "client", "ville", "dateFin"];

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[°º#_.\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function guessMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const used = new Set<number>();
  const normalized = headers.map(normalizeHeader);
  for (const field of FIELDS) {
    const matches = (h: string, k: string) =>
      h === k || h.split(" ").includes(k) || (k.length > 3 && h.includes(k));
    const idx = normalized.findIndex((h, i) => !used.has(i) && h && field.keywords.some((k) => matches(h, k)));
    if (idx >= 0) {
      mapping[field.key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function cell(row: unknown[], idx: number | undefined): string {
  if (idx === undefined || idx < 0) return "";
  const v = row[idx];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

interface CheckedRow {
  row: ImportRow;
  line: number;
  probleme?: string;
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>("fichier");
  const [result, setResult] = useState<ImportResult | null>(null);

  return (
    <>
      <PageHeader
        title="Import du parc"
        description="Intégrez vos modules depuis l'export de votre logiciel actuel, une liste de numéros ou une saisie à la main. Chaque numéro reçoit un QR code."
      />

      {result && (
        <div className="mb-6">
          <Alert tone="green">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {result.modulesCrees} module(s) intégré(s)
                {result.modulesLoues > 0 && `, dont ${result.modulesLoues} déjà en location sur ${result.contratsCrees} contrat(s) repris`}.
              </span>
              <span className="flex gap-3">
                <Link href="/parc" className="font-medium underline">
                  Voir le parc
                </Link>
                <Link href="/parc/plaques" className="font-medium underline">
                  Imprimer les QR codes
                </Link>
              </span>
            </div>
          </Alert>
        </div>
      )}

      <div className="mb-5 inline-flex rounded-lg bg-slate-100 p-1">
        {(
          [
            ["fichier", "Fichier Excel / CSV", FileSpreadsheet],
            ["liste", "Coller une liste", ListPlus],
            ["manuel", "Ajout manuel", PenLine],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
              tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "fichier" && <FileImport onDone={setResult} />}
      {tab === "liste" && <PasteImport onDone={setResult} />}
      {tab === "manuel" && <ManualAdd />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Import par fichier, avec correspondance des colonnes et contrôle avant import
// ---------------------------------------------------------------------------

function FileImport({ onDone }: { onDone: (r: ImportResult) => void }) {
  const { data, importRows } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Record<string, unknown[][]>>({});
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [voirColonnes, setVoirColonnes] = useState(false);
  const [ia, setIa] = useState<{ etat: "idle" | "running" | "done" | "indisponible" | "erreur"; remarque: string }>({ etat: "idle", remarque: "" });

  const table = sheets[sheet] ?? [];
  const headers = (table[headerRow] ?? []).map((h) => String(h ?? "").trim());
  const body = table.slice(headerRow + 1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const isText = /\.(csv|txt)$/i.test(file.name);
      // Les CSV exportés par Excel en France sont souvent en Windows-1252 : on détecte l'encodage
      // pour éviter les accents illisibles (« DÃ©pÃ´t »).
      const wb = isText
        ? XLSX.read(decodeText(buffer), { type: "string", raw: true })
        : XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
      const parsed: Record<string, unknown[][]> = {};
      for (const name of wb.SheetNames) {
        parsed[name] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: "", raw: true });
      }
      const first = wb.SheetNames.find((n) => (parsed[n]?.length ?? 0) > 0) ?? wb.SheetNames[0];
      const rows = parsed[first] ?? [];
      const hr = Math.max(0, rows.findIndex((r) => r.filter((c) => String(c ?? "").trim() !== "").length >= 1));
      setSheets(parsed);
      setSheet(first);
      setHeaderRow(hr);
      setMapping(guessMapping((rows[hr] ?? []).map((h) => String(h ?? ""))));
      setFileName(file.name);
      reconnaitre(parsed);
    } catch (err) {
      console.error(err);
      setError("Ce fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un fichier Excel (.xlsx, .xls) ou CSV.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Claude reconnaît la feuille, la ligne des titres et les colonnes à partir des premières lignes du fichier.
  const reconnaitre = async (parsed: Record<string, unknown[][]>) => {
    setIa({ etat: "running", remarque: "" });
    try {
      const feuilles = Object.entries(parsed)
        .filter(([, rows]) => rows.length > 0)
        .slice(0, 6)
        .map(([nom, rows]) => ({ nom, lignes: rows.slice(0, 40).map((r) => r.map((c) => String(c ?? ""))) }));
      const res = await fetch("/api/analyse-parc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ feuilles }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        resultat?: { feuille: string; ligneTitres: number; colonnes: Record<string, number>; remarque: string };
        error?: string;
      };
      if (res.status === 501 || res.status === 404) return setIa({ etat: "indisponible", remarque: "" });
      if (!res.ok || !json.resultat) throw new Error(json.error || "Reconnaissance impossible");
      const r = json.resultat;
      setSheet(r.feuille);
      setHeaderRow(r.ligneTitres);
      setMapping(r.colonnes);
      setIa({ etat: "done", remarque: r.remarque });
    } catch (err) {
      console.error(err);
      setIa({ etat: "erreur", remarque: err instanceof Error ? err.message : "" });
    }
  };

  const changeSheet = (name: string) => {
    setSheet(name);
    const rows = sheets[name] ?? [];
    setHeaderRow(0);
    setMapping(guessMapping((rows[0] ?? []).map((h) => String(h ?? ""))));
  };

  const changeHeaderRow = (n: number) => {
    setHeaderRow(n);
    setMapping(guessMapping((table[n] ?? []).map((h) => String(h ?? ""))));
  };

  // Contrôle de chaque ligne avant import.
  const checked: CheckedRow[] = useMemo(() => {
    const existing = new Set(data.modules.map((m) => normalizeNumero(m.numero)));
    const seen = new Set<string>();
    return body.map((r, i) => {
      const row: ImportRow = {
        numero: cell(r, mapping.numero),
        type: cell(r, mapping.type),
        dimensions: cell(r, mapping.dimensions),
        equipements: cell(r, mapping.equipements),
        depot: cell(r, mapping.depot),
        contrat: cell(r, mapping.contrat),
        client: cell(r, mapping.client),
        ville: cell(r, mapping.ville),
        dateFin: parseLooseDate(mapping.dateFin !== undefined ? r[mapping.dateFin] : ""),
      };
      const line = headerRow + i + 2;
      const key = normalizeNumero(row.numero);
      let probleme: string | undefined;
      if (!row.numero) probleme = "Numéro manquant";
      else if (existing.has(key)) probleme = "Déjà dans le parc";
      else if (seen.has(key)) probleme = "En double dans le fichier";
      if (row.numero) seen.add(key);
      return { row, line, probleme };
    });
  }, [body, mapping, data.modules, headerRow]);

  const valides = checked.filter((c) => !c.probleme);
  const rejetes = checked.filter((c) => c.probleme);
  const avecContrat = valides.filter((c) => c.row.contrat).length;

  const downloadTemplate = () => {
    const csv =
      "numero;type;dimensions;equipements;agence;contrat;client;ville;date_fin\n" +
      "BAT-0001;Bureau;6 x 2,44 m;Climatisation;Meyzieu;;;;\n" +
      "BAT-0002;Sanitaire;6 x 2,44 m;2 WC, 2 lavabos;Meyzieu;LOC-2026-118;Entreprise Martin;Lyon;30/06/2027\n";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-import-loc-and-go.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    const res = importRows(valides.map((c) => c.row));
    onDone(res);
    setSheets({});
    setSheet("");
    setFileName("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!fileName) {
    return (
      <Card>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 px-6 py-12 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files?.[0]);
          }}
        >
          <Upload className="h-8 w-8 text-slate-400" />
          <p className="font-medium text-slate-900">Déposez votre fichier Excel ou CSV ici</p>
          <p className="flex items-center gap-1.5 text-sm text-brand-700">
            <Sparkles className="h-4 w-4" /> Claude reconnaît tout seul les colonnes, quel que soit le format de votre export.
          </p>
          <p className="max-w-md text-sm text-slate-500">
            Une ligne par module. Seule la colonne du numéro est obligatoire. Si un module est déjà loué, indiquez son numéro de contrat : il sera rattaché automatiquement.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={() => inputRef.current?.click()} disabled={loading} icon={<Upload className="h-4 w-4" />}>
              {loading ? "Lecture…" : "Choisir un fichier"}
            </Button>
            <Button variant="secondary" onClick={downloadTemplate} icon={<Download className="h-4 w-4" />}>
              Modèle de fichier
            </Button>
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.ods,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title={ia.etat === "done" ? `Fichier « ${fileName} »` : `1. Colonnes du fichier « ${fileName} »`}
        actions={
          <div className="flex gap-1">
            {ia.etat === "done" && (
              <Button variant="ghost" size="sm" onClick={() => setVoirColonnes(!voirColonnes)}>
                {voirColonnes ? "Masquer les colonnes" : "Modifier les colonnes"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFileName("");
                setVoirColonnes(false);
                setIa({ etat: "idle", remarque: "" });
              }}
            >
              Changer de fichier
            </Button>
          </div>
        }
      >
        {ia.etat === "running" && (
          <div className="mb-5">
            <Alert tone="blue">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-pulse" /> Claude lit le fichier pour reconnaître les colonnes…
              </span>
            </Alert>
          </div>
        )}
        {ia.etat === "done" && (
          <div className="mb-5">
            <Alert tone="green">
              <span className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 flex-none" />
                <span>
                  Claude a lu le fichier et préparé la liste des modules ci-dessous. {ia.remarque} Relisez-la, puis cliquez sur « Valider et intégrer ».
                </span>
              </span>
            </Alert>
          </div>
        )}
        {ia.etat === "erreur" && (
          <div className="mb-5">
            <Alert tone="amber">
              Claude n&apos;a pas pu lire ce fichier ({ia.remarque}). Les colonnes ont été devinées d&apos;après leurs titres : vérifiez-les.{" "}
              <button className="font-medium underline" onClick={() => reconnaitre(sheets)}>
                Réessayer
              </button>
            </Alert>
          </div>
        )}
        {(ia.etat === "indisponible" || ia.etat === "erreur" || voirColonnes) && (
          <>
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          {Object.keys(sheets).length > 1 && (
            <Field label="Feuille">
              <Select value={sheet} onChange={(e) => changeSheet(e.target.value)}>
                {Object.keys(sheets).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Ligne des titres de colonnes" hint="La ligne qui contient « Numéro », « Type »…">
            <Select value={headerRow} onChange={(e) => changeHeaderRow(Number(e.target.value))}>
              {table.slice(0, 10).map((r, i) => (
                <option key={i} value={i}>
                  Ligne {i + 1} : {r.filter(Boolean).slice(0, 4).join(" · ").slice(0, 60)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mb-3 text-sm text-slate-600">Vérifiez à quelle colonne de votre fichier correspond chaque information.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISPLAY_ORDER.map((key) => {
            const f = FIELDS.find((x) => x.key === key)!;
            return (
              <Field key={key} label={f.label} hint={f.hint} required={key === "numero"}>
                <Select
                  value={mapping[key] ?? -1}
                  onChange={(e) => setMapping({ ...mapping, [key]: Number(e.target.value) })}
                >
                  <option value={-1}>— Ne pas importer —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Colonne ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          })}
        </div>
          </>
        )}
      </Card>

      {ia.etat !== "running" && (
      <Card title={ia.etat === "done" ? "Modules trouvés par Claude : à relire" : "2. Contrôle avant import"}>
        {mapping.numero === undefined || mapping.numero < 0 ? (
          <Alert tone="red">Indiquez la colonne qui contient le numéro du module.</Alert>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <p className="text-2xl font-semibold text-emerald-700">{valides.length}</p>
                <p className="text-xs text-emerald-800">module(s) prêts à intégrer</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-3 ring-1 ring-sky-200">
                <p className="text-2xl font-semibold text-sky-700">{avecContrat}</p>
                <p className="text-xs text-sky-800">déjà en location (contrat repris)</p>
              </div>
              <div className={clsx("rounded-lg p-3 ring-1", rejetes.length ? "bg-rose-50 ring-rose-200" : "bg-slate-50 ring-slate-200")}>
                <p className={clsx("text-2xl font-semibold", rejetes.length ? "text-rose-700" : "text-slate-500")}>{rejetes.length}</p>
                <p className={clsx("text-xs", rejetes.length ? "text-rose-800" : "text-slate-500")}>ligne(s) écartée(s)</p>
              </div>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-lg ring-1 ring-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Ligne</th>
                    {DISPLAY_ORDER.filter((k) => mapping[k] !== undefined && mapping[k] >= 0).map((k) => (
                      <th key={k} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        {FIELDS.find((f) => f.key === k)?.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Contrôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {checked.slice(0, 200).map((c) => (
                    <tr key={c.line} className={c.probleme ? "bg-rose-50/60" : undefined}>
                      <td className="px-3 py-2 text-xs text-slate-400">{c.line}</td>
                      {DISPLAY_ORDER.filter((k) => mapping[k] !== undefined && mapping[k] >= 0).map((k) => (
                        <td key={k} className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {(k === "dateFin" && c.row.dateFin ? formatDate(c.row.dateFin) : c.row[k]) || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {c.probleme ? <span className="font-medium text-rose-700">{c.probleme}</span> : <span className="text-emerald-700">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {checked.length > 200 && <p className="mt-2 text-xs text-slate-500">Aperçu limité aux 200 premières lignes ; toutes seront contrôlées et importées.</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={doImport} disabled={valides.length === 0} icon={<CheckCircle2 className="h-4 w-4" />}>
                {ia.etat === "done" ? "Valider et intégrer" : "Intégrer"} {valides.length} module(s)
              </Button>
              {rejetes.length > 0 && <span className="text-sm text-slate-500">Les lignes écartées ne seront pas importées.</span>}
            </div>
          </>
        )}
      </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coller une liste de numéros
// ---------------------------------------------------------------------------

function PasteImport({ onDone }: { onDone: (r: ImportResult) => void }) {
  const { data, importRows } = useStore();
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [depot, setDepot] = useState("");

  const numeros = useMemo(
    () =>
      text
        .split(/[\n;,\t]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [text],
  );
  const existing = new Set(data.modules.map((m) => normalizeNumero(m.numero)));
  const uniques = Array.from(new Map(numeros.map((n) => [normalizeNumero(n), n])).values());
  const nouveaux = uniques.filter((n) => !existing.has(normalizeNumero(n)));
  const ignores = numeros.length - nouveaux.length;

  const submit = () => {
    const res = importRows(
      nouveaux.map((numero) => ({ numero, type, dimensions, equipements: "", depot, contrat: "", client: "", ville: "", dateFin: "" })),
    );
    onDone(res);
    setText("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Card title="Coller une liste de numéros">
      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Numéros de modules" hint="Un numéro par ligne (ou séparés par des virgules / points-virgules).">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={"BAT-0001\nBAT-0002\nBAT-0003"} className="font-mono" />
        </Field>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Les informations ci-dessous s&apos;appliquent à tous les numéros collés. Elles restent modifiables module par module.</p>
          <Field label="Type de module">
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Bureau, Sanitaire, Vestiaire…" />
          </Field>
          <Field label="Dimensions">
            <Input value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="6 x 2,44 m" />
          </Field>
          <Field label="Agence">
            <Input value={depot} onChange={(e) => setDepot(e.target.value)} placeholder="Meyzieu" />
          </Field>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
            <strong>{nouveaux.length}</strong> nouveau(x) module(s)
            {ignores > 0 && <span className="text-slate-500"> · {ignores} ignoré(s) (doublon ou déjà dans le parc)</span>}
          </div>
          <Button onClick={submit} disabled={nouveaux.length === 0} icon={<CheckCircle2 className="h-4 w-4" />}>
            Intégrer {nouveaux.length} module(s)
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ajout manuel
// ---------------------------------------------------------------------------

function ManualAdd() {
  const { data, addModule } = useStore();
  const empty = { numero: "", type: "", dimensions: "", equipements: "", depot: "" };
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const types = Array.from(new Set(data.modules.map((m) => m.type).filter(Boolean)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addModule(form);
    if (res.ok) {
      setMessage({ tone: "green", text: `Module ${form.numero.trim()} ajouté. Vous pouvez en saisir un autre.` });
      setForm({ ...empty, type: form.type, dimensions: form.dimensions, depot: form.depot });
    } else {
      setMessage({ tone: "red", text: res.error });
    }
  };

  return (
    <Card title="Ajouter un module">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Numéro du module" required>
            <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="BAT-0412" autoFocus />
          </Field>
          <Field label="Type de module">
            <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} list="types-modules" placeholder="Bureau, Sanitaire…" />
            <datalist id="types-modules">
              {types.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Dimensions">
            <Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="6 x 2,44 m" />
          </Field>
          <Field label="Agence">
            <Input value={form.depot} onChange={(e) => setForm({ ...form, depot: e.target.value })} placeholder="Meyzieu" />
          </Field>
          <Field label="Équipements">
            <Input value={form.equipements} onChange={(e) => setForm({ ...form, equipements: e.target.value })} placeholder="Climatisation, 2 bureaux…" />
          </Field>
        </div>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" icon={<CheckCircle2 className="h-4 w-4" />}>
          Ajouter au parc
        </Button>
      </form>
    </Card>
  );
}
