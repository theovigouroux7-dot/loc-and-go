"use client";

import { Camera, CameraOff, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Input } from "./ui";

/**
 * Lecture d'un QR code par la caméra, avec saisie manuelle du numéro en secours
 * (pas de réseau, plaque abîmée, caméra refusée…).
 */
export function Scanner({
  onResult,
  placeholder = "Numéro du module (ex. BAT-0412)",
  autoStart = false,
}: {
  onResult: (text: string) => void;
  placeholder?: string;
  autoStart?: boolean;
}) {
  const regionId = `scan-${useId().replace(/:/g, "")}`;
  const [active, setActive] = useState(autoStart);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    setError("");

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;
        const scanner = new Html5Qrcode(regionId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            onResultRef.current(decoded);
            setActive(false);
          },
          () => {
            /* pas de code dans l'image : on continue */
          },
        );
      } catch (err) {
        console.error(err);
        setError(
          "Caméra indisponible. Autorisez l'accès à la caméra (ouvrez l'aperçu dans un nouvel onglet si besoin) ou saisissez le numéro ci-dessous.",
        );
        setActive(false);
      }
    })();

    return () => {
      stopped = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {
            /* déjà arrêté */
          });
      }
    };
  }, [active, regionId]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manual.trim()) return;
    onResult(manual.trim());
    setManual("");
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-slate-900">
        <div id={regionId} className={active ? "min-h-[260px]" : "hidden"} />
        {!active && (
          <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 p-6 text-center">
            <Button type="button" variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => setActive(true)}>
              Scanner le QR code
            </Button>
            <p className="text-xs text-slate-400">La caméra arrière du téléphone s&apos;ouvre.</p>
          </div>
        )}
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
