"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { remoteEnabled } from "@/lib/remote";

export interface EspaceInfo {
  slug: string;
  nom: string;
  plan: "essai" | "complet";
  limiteMateriels: number | null;
  local: boolean; // données dans le navigateur (pas de base en ligne)
}

export const ESPACE_LOCAL: EspaceInfo = { slug: "principal", nom: "", plan: "complet", limiteMateriels: null, local: true };

const EspaceContext = createContext<EspaceInfo>(ESPACE_LOCAL);

export function useEspace(): EspaceInfo {
  return useContext(EspaceContext);
}

export function useEssai(): boolean {
  return useEspace().plan === "essai";
}

/** Vérifie la connexion à un espace avant d'afficher le logiciel. */
export function EspaceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [espace, setEspace] = useState<EspaceInfo | null>(remoteEnabled ? null : ESPACE_LOCAL);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!remoteEnabled) return;
    let annule = false;
    fetch("/api/session", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (annule) return;
        if (res.status === 401) return router.replace("/connexion");
        if (!res.ok) return setErreur(body.error || `Erreur ${res.status}`);
        setEspace({ ...body, local: false });
      })
      .catch(() => !annule && setErreur("Connexion au serveur impossible."));
    return () => {
      annule = true;
    };
  }, [router]);

  if (erreur) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="max-w-md rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">{erreur}</p>
      </div>
    );
  }
  if (!espace) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  return <EspaceContext.Provider value={espace}>{children}</EspaceContext.Provider>;
}
