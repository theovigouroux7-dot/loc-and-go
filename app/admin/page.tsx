"use client";

import clsx from "clsx";
import { Bell, Copy, Download, ExternalLink, KeyRound, LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

interface EspaceAdmin {
  slug: string;
  nom: string;
  code: string;
  plan: "essai" | "complet";
  cree_le?: string;
  derniere_connexion?: string | null;
  materiels: number;
}

interface Demo {
  id: string;
  cree_le?: string;
  nom: string;
  societe: string;
  telephone: string;
  email: string;
  message: string;
  espace: string;
  traitee: boolean;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
  return body as T;
}

function bip() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
  } catch {
    /* son indisponible */
  }
}

export default function AdminPage() {
  const [etat, setEtat] = useState<"chargement" | "non-configure" | "connexion" | "ok">("chargement");

  useEffect(() => {
    api<{ admin: boolean; configure: boolean }>("/api/admin")
      .then((r) => setEtat(!r.configure ? "non-configure" : r.admin ? "ok" : "connexion"))
      .catch(() => setEtat("non-configure"));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-transparent.png" alt="" className="h-8 w-8" />
            <span className="text-sm font-semibold text-slate-900">Loc and Go · Administration</span>
          </a>
          {etat === "ok" && (
            <button
              onClick={async () => {
                await fetch("/api/admin", { method: "DELETE" });
                setEtat("connexion");
              }}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" /> Se déconnecter
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {etat === "chargement" && <p className="text-sm text-slate-500">Chargement…</p>}
        {etat === "non-configure" && (
          <Alert tone="amber">
            L&apos;administration n&apos;est pas encore configurée. Dans Vercel, ajoutez les variables ADMIN_PASSWORD et SUPABASE_SERVICE_ROLE_KEY, puis redéployez.
          </Alert>
        )}
        {etat === "connexion" && <AdminLogin onOk={() => setEtat("ok")} />}
        {etat === "ok" && <AdminTableau onDeconnecte={() => setEtat("connexion")} />}
      </main>
    </div>
  );
}

function AdminLogin({ onOk }: { onOk: () => void }) {
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setErreur("");
        try {
          await api("/api/admin", { method: "POST", body: JSON.stringify({ motDePasse: mdp }) });
          onOk();
        } catch (err) {
          setErreur(err instanceof Error ? err.message : "Connexion impossible.");
        }
      }}
      className="mx-auto mt-10 max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
    >
      <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <KeyRound className="h-5 w-5 text-brand-600" /> Administration
      </h1>
      <Field label="Mot de passe">
        <Input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoFocus />
      </Field>
      {erreur && <Alert tone="red">{erreur}</Alert>}
      <Button type="submit" className="w-full justify-center" disabled={!mdp}>
        Entrer
      </Button>
    </form>
  );
}

function AdminTableau({ onDeconnecte }: { onDeconnecte: () => void }) {
  const [espaces, setEspaces] = useState<EspaceAdmin[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [filtre, setFiltre] = useState("");
  const [creation, setCreation] = useState({ nombre: 100, plan: "essai", prefixe: "" });
  const [occupe, setOccupe] = useState(false);
  const demosVues = useRef<Set<string> | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const lien = (slug: string) => `${origin}/espace/${slug}`;

  const gererErreur = useCallback(
    (err: unknown) => {
      const text = err instanceof Error ? err.message : "Erreur";
      if (/réservé/i.test(text)) return onDeconnecte();
      setMessage({ tone: "red", text });
    },
    [onDeconnecte],
  );

  const chargerEspaces = useCallback(() => api<{ espaces: EspaceAdmin[] }>("/api/admin/espaces").then((r) => setEspaces(r.espaces)).catch(gererErreur), [gererErreur]);

  const chargerDemos = useCallback(async () => {
    try {
      const r = await api<{ demos: Demo[] }>("/api/admin/demos");
      if (demosVues.current) {
        const nouvelles = r.demos.filter((d) => !demosVues.current!.has(d.id));
        if (nouvelles.length) {
          bip();
          setMessage({ tone: "green", text: `Nouvelle demande de démo : ${nouvelles[0].nom}${nouvelles[0].societe ? ` (${nouvelles[0].societe})` : ""}.` });
        }
      }
      demosVues.current = new Set(r.demos.map((d) => d.id));
      setDemos(r.demos);
    } catch (err) {
      gererErreur(err);
    }
  }, [gererErreur]);

  useEffect(() => {
    chargerEspaces();
    chargerDemos();
    const timer = window.setInterval(chargerDemos, 15_000);
    return () => window.clearInterval(timer);
  }, [chargerEspaces, chargerDemos]);

  const visibles = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    return q ? espaces.filter((e) => `${e.nom} ${e.slug} ${e.code}`.toLowerCase().includes(q)) : espaces;
  }, [espaces, filtre]);

  const modifier = async (slug: string, patch: Record<string, unknown>) => {
    try {
      const r = await api<Partial<EspaceAdmin>>(`/api/admin/espaces/${slug}`, { method: "PATCH", body: JSON.stringify(patch) });
      setEspaces((list) => list.map((e) => (e.slug === slug ? { ...e, ...r } : e)));
    } catch (err) {
      gererErreur(err);
    }
  };

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOccupe(true);
    try {
      const r = await api<{ crees: number }>("/api/admin/espaces", { method: "POST", body: JSON.stringify(creation) });
      setMessage({ tone: "green", text: `${r.crees} espace(s) créé(s).` });
      await chargerEspaces();
    } catch (err) {
      gererErreur(err);
    } finally {
      setOccupe(false);
    }
  };

  const exporter = () => {
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lignes = [["nom", "lien", "code", "version", "materiels"].join(";"), ...espaces.map((e) => [e.nom, lien(e.slug), e.code, e.plan, String(e.materiels)].map(esc).join(";"))];
    const blob = new Blob(["﻿" + lignes.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `loc-and-go-espaces-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const aTraiter = demos.filter((d) => !d.traitee).length;

  return (
    <div className="space-y-6">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Card
        title={
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Demandes de démo
            {aTraiter > 0 && <span className="rounded-full bg-rose-600 px-2 text-xs font-semibold text-white">{aTraiter}</span>}
          </span>
        }
      >
        {demos.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune demande pour l&apos;instant. Elles arrivent ici, avec un signal sonore si la page est ouverte.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {demos.map((d) => (
              <li key={d.id} className={clsx("flex flex-wrap items-start gap-3 py-3", d.traitee && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {d.nom}
                    {d.societe && <span className="font-normal text-slate-500"> · {d.societe}</span>}
                  </p>
                  <p className="text-sm text-slate-700">
                    {d.telephone && (
                      <a href={`tel:${d.telephone}`} className="mr-3 underline">
                        {d.telephone}
                      </a>
                    )}
                    {d.email && (
                      <a href={`mailto:${d.email}`} className="underline">
                        {d.email}
                      </a>
                    )}
                  </p>
                  {d.message && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{d.message}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {d.cree_le && formatDateTime(d.cree_le)}
                    {d.espace && ` · depuis l'espace ${d.espace}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await api(`/api/admin/demos/${d.id}`, { method: "PATCH", body: JSON.stringify({ traitee: !d.traitee }) }).catch(gererErreur);
                    setDemos((list) => list.map((x) => (x.id === d.id ? { ...x, traitee: !x.traitee } : x)));
                  }}
                >
                  {d.traitee ? "Remettre à traiter" : "Marquer traitée"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Créer des espaces">
        <form onSubmit={creer} className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <Field label="Nombre">
              <Input type="number" min={1} max={500} value={creation.nombre} onChange={(e) => setCreation({ ...creation, nombre: Number(e.target.value) || 1 })} />
            </Field>
          </div>
          <div className="w-44">
            <Field label="Version">
              <Select value={creation.plan} onChange={(e) => setCreation({ ...creation, plan: e.target.value })}>
                <option value="essai">Essai (restreinte)</option>
                <option value="complet">Complète</option>
              </Select>
            </Field>
          </div>
          <div className="min-w-[200px] flex-1">
            <Field label="Nom (facultatif)" hint="Ex. « Test novembre » donne Test novembre 1, 2, 3…">
              <Input value={creation.prefixe} onChange={(e) => setCreation({ ...creation, prefixe: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" disabled={occupe} icon={<Plus className="h-4 w-4" />}>
            {occupe ? "Création…" : "Créer"}
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Version d&apos;essai : pas d&apos;analyse par Claude, pas de prestations complémentaires dans l&apos;espace client, 50 QR codes au maximum.
        </p>
      </Card>

      <Card
        title={`Espaces (${espaces.length})`}
        actions={
          <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exporter} disabled={espaces.length === 0}>
            Exporter liens et codes (CSV)
          </Button>
        }
      >
        <div className="mb-3 max-w-xs">
          <Input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher un nom, un identifiant…" aria-label="Rechercher" />
        </div>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2">Nom</th>
                <th className="px-3 py-2">Lien</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2 text-right">Matériels</th>
                <th className="px-3 py-2">Dernière connexion</th>
                <th className="px-5 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((e) => (
                <tr key={e.slug}>
                  <td className="px-5 py-2">
                    <Input
                      defaultValue={e.nom}
                      onBlur={(ev) => ev.target.value.trim() !== e.nom && modifier(e.slug, { nom: ev.target.value })}
                      aria-label={`Nom de l'espace ${e.slug}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(lien(e.slug)).then(() => setMessage({ tone: "green", text: `Lien copié : ${lien(e.slug)}` }))}
                      className="flex items-center gap-1.5 font-mono text-xs text-brand-700 hover:underline"
                      title="Copier le lien"
                    >
                      /espace/{e.slug} <Copy className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono">{e.code}</td>
                  <td className="px-3 py-2">
                    <Select value={e.plan} onChange={(ev) => modifier(e.slug, { plan: ev.target.value })} aria-label={`Version de ${e.slug}`}>
                      <option value="essai">Essai</option>
                      <option value="complet">Complète</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.materiels}</td>
                  <td className="px-3 py-2 text-slate-500">{e.derniere_connexion ? formatDateTime(e.derniere_connexion) : "jamais"}</td>
                  <td className="px-5 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<ExternalLink className="h-4 w-4" />}
                        onClick={async () => {
                          try {
                            await api(`/api/admin/espaces/${e.slug}`, { method: "POST" });
                            window.open("/app", "_blank");
                          } catch (err) {
                            gererErreur(err);
                          }
                        }}
                      >
                        Ouvrir
                      </Button>
                      <button
                        type="button"
                        onClick={() => window.confirm(`Générer un nouveau code pour ${e.nom} ? L'ancien ne fonctionnera plus.`) && modifier(e.slug, { nouveauCode: true })}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Nouveau code"
                        aria-label={`Nouveau code pour ${e.slug}`}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      {e.slug !== "principal" && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Supprimer l'espace ${e.nom} et toutes ses données ?`)) return;
                            try {
                              await api(`/api/admin/espaces/${e.slug}`, { method: "DELETE" });
                              setEspaces((list) => list.filter((x) => x.slug !== e.slug));
                            } catch (err) {
                              gererErreur(err);
                            }
                          }}
                          className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Supprimer"
                          aria-label={`Supprimer ${e.slug}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
