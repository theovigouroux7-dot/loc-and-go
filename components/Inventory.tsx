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
