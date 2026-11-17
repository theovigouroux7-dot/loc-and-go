"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import type { InventaireCoche } from "@/lib/types";

export function InventoryChecklist({
  items,
  value,
  onChange,
  readOnly,
  uncheckedTone = "neutral",
}: {
  items: string[];
  value: InventaireCoche;
  onChange?: (next: InventaireCoche) => void;
  readOnly?: boolean;
  /** « alert » : un élément non coché est mis en évidence (ex. matériel manquant au retour). */
  uncheckedTone?: "neutral" | "alert";
}) {
  const done = items.filter((i) => value[i]).length;
  const toggle = (item: string) => {
    if (readOnly || !onChange) return;
    onChange({ ...value, [item]: !value[item] });
  };
  const all = () => onChange?.(Object.fromEntries(items.map((i) => [i, true])));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {done} / {items.length} élément(s) coché(s)
        </span>
        {!readOnly && done < items.length && (
          <button type="button" onClick={all} className="font-medium text-brand-600 hover:text-brand-700">
            Tout cocher
          </button>
        )}
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
        {items.map((item) => {
          const checked = !!value[item];
          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => toggle(item)}
                disabled={readOnly}
                className={clsx(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm",
                  !readOnly && "hover:bg-slate-50",
                  !checked && uncheckedTone === "alert" && "bg-rose-50/60",
                )}
              >
                <span
                  className={clsx(
                    "flex h-5 w-5 flex-none items-center justify-center rounded border",
                    checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white",
                  )}
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className={clsx(checked ? "text-slate-900" : "text-slate-600")}>{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Choix des équipements optionnels par l'atelier : ce qui se trouve réellement dans le module,
 * avec la quantité pour ce qui se compte (tables, chaises…).
 */
export function EquipementsPicker({
  defs,
  value,
  onChange,
  readOnly,
  prevus = {},
}: {
  defs: { nom: string; quantifiable: boolean }[];
  prevus?: Record<string, number>;
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  readOnly?: boolean;
}) {
  const set = (nom: string, q: number) => {
    const next = { ...value };
    if (q > 0) next[nom] = q;
    else delete next[nom];
    onChange(next);
  };
  const retenus = defs.filter((d) => (value[d.nom] ?? 0) > 0).length;

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">{retenus} équipement(s) retenu(s)</p>
      <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
        {defs.map((d) => {
          const q = value[d.nom] ?? 0;
          const on = q > 0;
          return (
            <li key={d.nom} className={clsx("flex items-center gap-3 px-3 py-2", on && "bg-emerald-50/50")}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => set(d.nom, on ? 0 : 1)}
                className="flex flex-1 items-center gap-3 text-left text-sm"
              >
                <span
                  className={clsx(
                    "flex h-5 w-5 flex-none items-center justify-center rounded border",
                    on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white",
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className={on ? "text-slate-900" : "text-slate-500"}>{d.nom}</span>
                {prevus[d.nom] !== undefined && (
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      q === prevus[d.nom] ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
                    )}
                  >
                    prévu : {prevus[d.nom]}
                  </span>
                )}
              </button>
              {d.quantifiable && on && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => set(d.nom, q - 1)}
                    className="h-8 w-8 rounded-lg bg-white text-lg leading-none text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                    aria-label={`Retirer un(e) ${d.nom}`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={q}
                    disabled={readOnly}
                    onChange={(e) => set(d.nom, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    className="h-8 w-14 rounded-lg border-0 text-center text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
                    aria-label={`Quantité de ${d.nom}`}
                  />
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => set(d.nom, q + 1)}
                    className="h-8 w-8 rounded-lg bg-white text-lg leading-none text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                    aria-label={`Ajouter un(e) ${d.nom}`}
                  >
                    +
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
