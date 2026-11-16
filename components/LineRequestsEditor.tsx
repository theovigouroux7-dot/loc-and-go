"use client";

import { Plus, Trash2 } from "lucide-react";
import type { LineRequest } from "@/lib/store";
import { Button, Input } from "./ui";

/** Saisie des modules demandés : un type et une quantité par ligne. */
export function LineRequestsEditor({
  value,
  onChange,
  types,
  disponibles,
}: {
  value: LineRequest[];
  onChange: (next: LineRequest[]) => void;
  types: string[];
  disponibles: Record<string, number>;
}) {
  const set = (i: number, patch: Partial<LineRequest>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {value.map((r, i) => {
        const dispo = disponibles[r.type.trim()] ?? 0;
        return (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <Input value={r.type} onChange={(e) => set(i, { type: e.target.value })} placeholder="Type de module (ex. Bureau)" list="types-contrat" />
              {r.type.trim() && (
                <p className={`mt-1 text-xs ${dispo >= r.quantite ? "text-emerald-700" : "text-amber-700"}`}>
                  {dispo} disponible(s) au parc pour ce type
                </p>
              )}
            </div>
            <Input
              type="number"
              min={1}
              value={r.quantite}
              onChange={(e) => set(i, { quantite: Math.max(1, Number(e.target.value) || 1) })}
              className="w-24"
              aria-label="Quantité"
            />
            <Button type="button" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} disabled={value.length === 1} aria-label="Retirer la ligne">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      <datalist id="types-contrat">
        {types.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...value, { type: "", quantite: 1 }])}>
        Ajouter un type de module
      </Button>
    </div>
  );
}
