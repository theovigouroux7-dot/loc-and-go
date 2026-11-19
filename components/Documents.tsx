"use client";

import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { deletePhoto, openDocument, saveDocument } from "@/lib/photos";
import type { ContractDocument } from "@/lib/types";
import { formatDate, nowIso } from "@/lib/utils";
import { Button } from "./ui";

const TYPE_LABEL: Record<ContractDocument["type"], string> = { plan: "Plan", contrat: "Contrat", autre: "Document" };

/** Liste des documents d'un contrat (plan d'implantation, contrat PDF…), avec ajout et ouverture. */
export function DocumentsList({
  value,
  onChange,
  readOnly,
  addLabel = "Joindre un plan",
  empty = "Aucun plan ni document joint.",
}: {
  value: ContractDocument[];
  onChange?: (next: ContractDocument[]) => void;
  readOnly?: boolean;
  addLabel?: string;
  empty?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = async (files: FileList | null) => {
    if (!files?.length || !onChange) return;
    setBusy(true);
    setError("");
    try {
      const ajouts: ContractDocument[] = [];
      for (const f of Array.from(files)) {
        const { id, mime } = await saveDocument(f);
        ajouts.push({ id, nom: f.name, type: /contrat/i.test(f.name) ? "contrat" : "plan", mime, ajouteLe: nowIso() });
      }
      onChange([...value, ...ajouts]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le fichier n'a pas pu être enregistré.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (doc: ContractDocument) => {
    if (!onChange || !window.confirm(`Retirer « ${doc.nom} » ?`)) return;
    onChange(value.filter((d) => d.id !== doc.id));
    await deletePhoto(doc.id);
  };

  const open = async (doc: ContractDocument) => {
    const ok = await openDocument(doc.id);
    if (!ok) setError("Ce document n'est plus disponible sur cet appareil.");
  };

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {value.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              {d.mime.startsWith("image/") ? <ImageIcon className="h-5 w-5 flex-none text-sky-600" /> : <FileText className="h-5 w-5 flex-none text-rose-600" />}
              <button type="button" onClick={() => open(d)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">{d.nom}</span>
                <span className="block text-xs text-slate-500">
                  {TYPE_LABEL[d.type]} · ajouté le {formatDate(d.ajouteLe)}
                </span>
              </button>
              {onChange && !readOnly && (
                <button type="button" onClick={() => remove(d)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Retirer ${d.nom}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {onChange && !readOnly && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          >
            {addLabel}
          </Button>
          <input ref={inputRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
        </>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
