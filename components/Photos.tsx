"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { deletePhoto, loadPhoto, savePhoto } from "@/lib/photos";

export function PhotoThumb({ id, onRemove, size = 96 }: { id: string; onRemove?: () => void; size?: number }) {
  const [src, setSrc] = useState<string>();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPhoto(id).then((s) => {
      if (!cancelled) setSrc(s);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <div className="group relative overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200" style={{ width: size, height: size }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Photo" className="h-full w-full cursor-zoom-in object-cover" onClick={() => setOpen(true)} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">Photo</div>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white"
            aria-label="Supprimer la photo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && src && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Photo" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
}

export function PhotoGallery({ ids, empty = "Aucune photo." }: { ids: string[]; empty?: string }) {
  if (ids.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <PhotoThumb key={id} id={id} />
      ))}
    </div>
  );
}

/** Prise de photos : ouvre l'appareil photo sur téléphone, le sélecteur de fichiers sur ordinateur. */
export function PhotoPicker({ value, onChange, label = "Ajouter une photo" }: { value: string[]; onChange: (ids: string[]) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const file of Array.from(files)) ids.push(await savePhoto(file));
      onChange([...value, ...ids]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    onChange(value.filter((p) => p !== id));
    await deletePhoto(id);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {value.map((id) => (
        <PhotoThumb key={id} id={id} onRemove={() => remove(id)} />
      ))}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-500 hover:text-brand-600"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        <span className="px-1 text-center">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
