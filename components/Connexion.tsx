"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { remoteEnabled } from "@/lib/remote";

/** Connexion à un espace : identifiant (dans le lien reçu) + code à 6 chiffres. */
export function Connexion({ slugInitial = "" }: { slugInitial?: string }) {
  const [slug, setSlug] = useState(slugInitial);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, code }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Connexion impossible.");
      window.location.href = "/app";
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Connexion impossible.");
      setEnvoi(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Link href="/" className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Loc and Go" className="h-28 w-auto" />
      </Link>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <KeyRound className="h-5 w-5 text-brand-600" /> Accéder à mon espace
        </h1>
        {!remoteEnabled ? (
          <p className="mt-3 text-sm text-slate-600">
            Version de démonstration locale : pas de connexion nécessaire.{" "}
            <Link href="/app" className="font-medium text-brand-700 underline">
              Ouvrir le logiciel
            </Link>
          </p>
        ) : (
          <form onSubmit={valider} className="mt-4 space-y-4">
            {slugInitial ? (
              <p className="text-sm text-slate-600">
                Espace <strong className="font-mono">{slugInitial}</strong> : saisissez le code reçu avec votre lien.
              </p>
            ) : (
              <Field label="Identifiant de l'espace" hint="Les lettres après /espace/ dans le lien reçu.">
                <Input value={slug} onChange={(e) => setSlug(e.target.value.trim().toLowerCase())} autoCapitalize="none" autoCorrect="off" />
              </Field>
            )}
            <Field label="Code d'accès">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 chiffres"
                autoFocus={Boolean(slugInitial)}
                className="font-mono text-lg tracking-[0.3em]"
              />
            </Field>
            {erreur && <Alert tone="red">{erreur}</Alert>}
            <Button type="submit" className="w-full justify-center" disabled={envoi || !slug || code.length < 4}>
              {envoi ? "Connexion…" : "Entrer"}
            </Button>
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Pas encore d&apos;espace ?{" "}
        <Link href="/#demo" className="font-medium text-brand-700 underline">
          Demander une démo
        </Link>
      </p>
    </div>
  );
}
