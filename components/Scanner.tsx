"use client";

import { Camera, CameraOff, ImageUp, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Input } from "./ui";

type Html5QrcodeInstance = {
  start: (...args: unknown[]) => Promise<unknown>;
  stop: () => Promise<void>;
  clear: () => void;
  scanFile: (file: File, showImage?: boolean) => Promise<string>;
};

let counter = 0;
const nextId = () => `qr-reader-${++counter}-${Date.now()}`;

function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  const text = String((err as { message?: string })?.message ?? err);
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "La caméra n'est disponible que sur une adresse sécurisée (https). Utilisez « Lire depuis une photo » ou saisissez le numéro.";
  }
  if (name === "NotAllowedError" || /permission|denied/i.test(text)) {
    const inFrame = typeof window !== "undefined" && window.self !== window.top;
    return inFrame
      ? "La caméra est bloquée dans cette fenêtre d'aperçu. Ouvrez l'application dans un nouvel onglet, ou utilisez « Lire depuis une photo »."
      : "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, ou utilisez « Lire depuis une photo ».";
  }
  if (name === "NotFoundError" || /not found|no camera/i.test(text)) {
    return "Aucune caméra détectée sur cet appareil. Utilisez « Lire depuis une photo » ou saisissez le numéro.";
  }
  if (name === "NotReadableError") {
    return "La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.";
  }
  return "Impossible d'ouvrir la caméra. Utilisez « Lire depuis une photo » ou saisissez le numéro.";
}

/**
 * Lecture d'un QR code : caméra en direct, photo du QR code (utile sur iPhone ou si la caméra est bloquée),
 * ou saisie manuelle du numéro en secours.
 */
export function Scanner({
  onResult,
  placeholder = "Numéro du module (ex. BAT-0412)",
}: {
  onResult: (text: string) => void;
  placeholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [reading, setReading] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!active) return;
    setError("");
    let cancelled = false;
    let done = false;
    let scanner: Html5QrcodeInstance | null = null;
    let startPromise: Promise<unknown> | null = null;
    let el: HTMLDivElement | null = null;

    // Léger délai : en développement, React monte et démonte deux fois le composant ;
    // sans ce délai, deux caméras s'ouvraient en même temps et la seconde échouait.
    const timer = window.setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !containerRef.current) return;
        el = document.createElement("div");
        el.id = nextId();
        el.style.width = "100%";
        containerRef.current.appendChild(el);
        scanner = new Html5Qrcode(el.id, { verbose: false }) as unknown as Html5QrcodeInstance;
        startPromise = scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w: number, h: number) => {
              const side = Math.floor(Math.min(w, h) * 0.7);
              return { width: side, height: side };
            },
          },
          (decoded: string) => {
            if (done) return;
            done = true;
            onResultRef.current(decoded);
            setActive(false);
          },
          () => {
            /* pas de QR code dans l'image : on continue */
          },
        );
        await startPromise;
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(cameraErrorMessage(err));
          setActive(false);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const s = scanner;
      const node = el;
      if (s && startPromise) {
        startPromise
          .then(() => s.stop())
          .catch(() => undefined)
          .finally(() => {
            try {
              s.clear();
            } catch {
              /* déjà nettoyé */
            }
            node?.remove();
          });
      } else {
        node?.remove();
      }
    };
  }, [active]);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setReading(true);
    const tmp = document.createElement("div");
    tmp.id = nextId();
    tmp.style.display = "none";
    document.body.appendChild(tmp);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = new Html5Qrcode(tmp.id, { verbose: false }) as unknown as Html5QrcodeInstance;
      const text = await reader.scanFile(file, false);
      onResultRef.current(text);
    } catch (err) {
      console.error(err);
      setError("Aucun QR code lisible sur cette photo. Reprenez-la de plus près, bien à plat, ou saisissez le numéro.");
    } finally {
      tmp.remove();
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manual.trim()) return;
    onResult(manual.trim());
    setManual("");
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-slate-900">
        <div ref={containerRef} className={active ? "min-h-[260px]" : "hidden"} />
        {!active && (
          <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => setActive(true)}>
                Scanner le QR code
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                onClick={() => fileRef.current?.click()}
                disabled={reading}
              >
                Lire depuis une photo
              </Button>
            </div>
            <p className="text-xs text-slate-400">La caméra arrière du téléphone s&apos;ouvre.</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>
      {active && (
        <Button type="button" variant="ghost" size="sm" icon={<CameraOff className="h-4 w-4" />} onClick={() => setActive(false)}>
          Arrêter la caméra
        </Button>
      )}
      {error && <p className="text-sm text-amber-700">{error}</p>}
      <form onSubmit={submitManual} className="flex gap-2">
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={placeholder} aria-label="Saisie manuelle du numéro" />
        <Button type="submit" variant="secondary" icon={<Search className="h-4 w-4" />}>
          Valider
        </Button>
      </form>
    </div>
  );
}
