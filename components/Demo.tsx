"use client";

import clsx from "clsx";
import { CheckCircle2, Lock, Send, X } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

/** Formulaire « Demander une démo » : la demande arrive dans la page admin. */
export function DemoForm({ onDone, contexte = "" }: { onDone?: () => void; contexte?: string }) {
  const [f, setF] = useState({ nom: "", societe: "", telephone: "", email: "", message: contexte });
  const [etat, setEtat] = useState<"saisie" | "envoi" | "ok">("saisie");
  const [erreur, setErreur] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    if (!f.nom.trim()) return setErreur("Indiquez votre nom.");
    if (!f.telephone.trim() && !f.email.trim()) return setErreur("Indiquez un téléphone ou un e-mail pour qu'on puisse vous rappeler.");
    setEtat("envoi");
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Envoi impossible.");
      setEtat("ok");
      onDone?.();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible.");
      setEtat("saisie");
    }
  };

  if (etat === "ok") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
        <p className="text-sm">
          <strong>Merci, votre demande est envoyée.</strong> Nous vous rappelons rapidement pour organiser la démonstration.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" required>
          <Input value={f.nom} onChange={set("nom")} autoComplete="name" />
        </Field>
        <Field label="Société">
          <Input value={f.societe} onChange={set("societe")} autoComplete="organization" />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" value={f.telephone} onChange={set("telephone")} autoComplete="tel" />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={f.email} onChange={set("email")} autoComplete="email" />
        </Field>
      </div>
      <Field label="Message">
        <Textarea rows={3} value={f.message} onChange={set("message")} placeholder="Votre activité, la taille de votre parc, vos questions…" />
      </Field>
      {erreur && <Alert tone="red">{erreur}</Alert>}
      <Button type="submit" disabled={etat === "envoi"} icon={<Send className="h-4 w-4" />}>
        {etat === "envoi" ? "Envoi…" : "Demander une démo"}
      </Button>
    </form>
  );
}

export function DemoDialog({ onClose, contexte }: { onClose: () => void; contexte?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Demander une démo"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">Demander une démo</p>
            <p className="text-sm text-slate-500">Nous vous présentons la version complète et répondons à vos questions.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <DemoForm contexte={contexte} />
      </div>
    </div>
  );
}

export function DemoButton({ label = "Demander une démo", contexte, variant = "primary" }: { label?: string; contexte?: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && <DemoDialog onClose={() => setOpen(false)} contexte={contexte} />}
    </>
  );
}

/**
 * Fonction réservée à la version complète : visible mais grisée, avec un cadenas.
 * Un clic fait apparaître le bouton « Demander une démo ».
 */
export function Verrou({ titre, description, className }: { titre: string; description?: string; className?: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className={clsx("rounded-xl border border-dashed border-slate-300 bg-slate-50", className)}>
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={ouvert}
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-200 text-slate-500">
          <Lock className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-500">{titre}</span>
          {description && <span className="mt-0.5 block text-sm text-slate-400">{description}</span>}
          <span className="mt-1 block text-xs font-medium text-orange-600">Version complète</span>
        </span>
      </button>
      {ouvert && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3">
          <p className="flex-1 text-sm text-slate-600">Cette fonction est incluse dans la version complète de Loc and Go.</p>
          <DemoButton contexte={`Intéressé par : ${titre}`} />
        </div>
      )}
    </div>
  );
}
