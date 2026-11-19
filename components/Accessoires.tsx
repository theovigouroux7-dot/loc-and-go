"use client";

import clsx from "clsx";
import { Check, Plus, X } from "lucide-react";
import type { ContractAccessoire } from "@/lib/types";
import { formatDateTime, uid } from "@/lib/utils";
import { Button, Input } from "./ui";

const SUGGESTIONS = ["Rampe d'accès PMR", "Escalier", "Passerelle", "Garde-corps", "Auvent", "Cuve d'effluents"];

/** Saisie des accessoires du contrat (rampes, escaliers…) : un nom et une quantité. */
export function AccessoiresEditor({ value, onChange }: { value: ContractAccessoire[]; onChange: (next: ContractAccessoire[]) => void }) {
  const set = (id: string, patch: Partial<ContractAccessoire>) => onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-sm text-slate-500">Aucun accessoire.</p>}
      {value.map((a) => (
        <div key={a.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input value={a.nom} onChange={(e) => set(a.id, { nom: e.target.value })} placeholder="Rampe d'accès PMR" list="accessoires-suggestions" aria-label="Nom de l'accessoire" />
          </div>
          <div className="w-20 flex-none">
            <Input
              type="number"
              min={1}
              value={a.quantite}
              onChange={(e) => set(a.id, { quantite: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              aria-label={`Quantité de ${a.nom || "l'accessoire"}`}
            />
          </div>
          <button type="button" onClick={() => onChange(value.filter((x) => x.id !== a.id))} className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label="Retirer l'accessoire">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <datalist id="accessoires-suggestions">
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Plus className="h-4 w-4" />}
        onClick={() => onChange([...value, { id: uid("acc"), nom: "", quantite: 1, pret: false }])}
      >
        Ajouter un accessoire
      </Button>
    </div>
  );
}

/** Liste à cocher par l'atelier : chaque accessoire coché est prêt au départ. */
export function AccessoiresChecklist({
  value,
  onToggle,
  readOnly,
}: {
  value: ContractAccessoire[];
  onToggle?: (id: string, pret: boolean) => void;
  readOnly?: boolean;
}) {
  if (value.length === 0) return <p className="text-sm text-slate-500">Aucun accessoire sur ce contrat.</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
      {value.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            disabled={readOnly || !onToggle}
            onClick={() => onToggle?.(a.id, !a.pret)}
            className={clsx("flex w-full items-center gap-3 px-3 py-3 text-left", !readOnly && onToggle && "hover:bg-slate-50", a.pret && "bg-emerald-50/50")}
          >
            <span
              className={clsx(
                "flex h-6 w-6 flex-none items-center justify-center rounded border",
                a.pret ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white",
              )}
            >
              {a.pret && <Check className="h-4 w-4" />}
            </span>
            <span className="flex-1">
              <span className={clsx("block text-sm font-medium", a.pret ? "text-slate-900" : "text-slate-700")}>
                {a.quantite} × {a.nom}
              </span>
              {a.pret && a.prepareLe && <span className="block text-xs text-emerald-700">Prêt depuis le {formatDateTime(a.prepareLe)}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
