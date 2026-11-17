"use client";

import { Plus, Trash2, X } from "lucide-react";
import { repartir, type LineRequest } from "@/lib/store";
import { Button, Input, Select } from "./ui";

/**
 * Saisie des modules demandés, groupe par groupe comme sur le contrat :
 * un type, une quantité, et les équipements du groupe en quantités totales (ex. 2 modules, 4 tables, 4 chaises).
 */
export function LineRequestsEditor({
  value,
  onChange,
  types,
  disponibles,
  catalogue,
}: {
  value: LineRequest[];
  onChange: (next: LineRequest[]) => void;
  types: string[];
  disponibles: Record<string, number>;
  catalogue: string[];
}) {
  const set = (i: number, patch: Partial<LineRequest>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setEquip = (i: number, nom: string, q: number) => {
    const eq = { ...(value[i].equipements ?? {}) };
    if (q > 0) eq[nom] = q;
    else delete eq[nom];
    set(i, { equipements: eq });
  };

  return (
    <div className="space-y-4">
      {value.map((r, i) => {
        const dispo = disponibles[r.type.trim()] ?? 0;
        const eq = r.equipements ?? {};
        const parModule = repartir(eq, Math.max(1, r.quantite))[0];
        const restants = catalogue.filter((c) => !(c in eq));
        return (
          <div key={i} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input value={r.type} onChange={(e) => set(i, { type: e.target.value })} placeholder="Type de module (ex. Bureau)" list="types-contrat" />
                {r.type.trim() && (
                  <p className={`mt-1 text-xs ${dispo >= r.quantite ? "text-emerald-700" : "text-amber-700"}`}>{dispo} disponible(s) au parc pour ce type</p>
                )}
              </div>
              <Input
                type="number"
                min={1}
                value={r.quantite}
                onChange={(e) => set(i, { quantite: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20"
                aria-label="Nombre de modules"
              />
              <Button type="button" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} disabled={value.length === 1} aria-label="Retirer le groupe">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={r.designation ?? ""}
              onChange={(e) => set(i, { designation: e.target.value })}
              placeholder="Désignation du contrat (facultatif, ex. Module OPEN SPACE 6,03 x 2,44 m)"
              className="mt-2"
            />

            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-slate-600">Équipements du groupe (quantités totales, comme sur le contrat)</p>
              {Object.keys(eq).length > 0 && (
                <ul className="mb-2 space-y-1.5">
                  {Object.entries(eq).map(([nom, q]) => (
                    <li key={nom} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-slate-800">{nom}</span>
                      <Input
                        type="number"
                        min={0}
                        value={q}
                        onChange={(e) => setEquip(i, nom, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                        className="w-20"
                        aria-label={`Quantité totale de ${nom}`}
                      />
                      <span className="w-24 text-xs text-slate-500">{r.quantite > 1 ? `≈ ${parModule[nom] ?? 0} / module` : ""}</span>
                      <button type="button" onClick={() => setEquip(i, nom, 0)} className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label={`Retirer ${nom}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {restants.length > 0 && (
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setEquip(i, e.target.value, r.quantite);
                  }}
                  aria-label="Ajouter un équipement"
                >
                  <option value="">+ Ajouter un équipement (clim, table, chaise, kitchenette…)</option>
                  {restants.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
        );
      })}
      <datalist id="types-contrat">
        {types.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...value, { type: "", quantite: 1, equipements: {} }])}>
        Ajouter un groupe de modules
      </Button>
    </div>
  );
}
