"use client";

import { Bell, BellOff, BellRing, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { REQUEST_LABEL } from "@/lib/status";
import { useStore } from "@/lib/store";
import type { ClientRequest } from "@/lib/types";

const PREF_KEY = "loc-and-go:alertes";

interface Toast {
  id: string;
  titre: string;
  detail: string;
}

/** Petit carillon à deux notes, joué par le navigateur (aucun fichier son). */
function carillon() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    window.setTimeout(() => ctx.close(), 1000);
  } catch {
    /* son indisponible */
  }
}

/**
 * Alertes du site : quand une nouvelle demande client arrive (SAV, retour, réserve, devis),
 * un bandeau s'affiche, un son est joué, et une notification du navigateur apparaît si l'onglet est en arrière-plan.
 */
export function useRequestAlerts() {
  const { data } = useStore();
  const vus = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actif, setActif] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "indisponible">("default");

  useEffect(() => {
    try {
      setActif(window.localStorage.getItem(PREF_KEY) !== "off");
    } catch {
      /* stockage indisponible */
    }
    setPermission(typeof Notification === "undefined" ? "indisponible" : Notification.permission);
  }, []);

  useEffect(() => {
    const ids = data.demandes.map((d) => d.id);
    // Premier passage : on mémorise l'existant sans alerter.
    if (!vus.current) {
      vus.current = new Set(ids);
      return;
    }
    const nouvelles = data.demandes.filter((d) => !vus.current!.has(d.id) && !d.traitee && d.message !== "Retour demandé par le bureau");
    ids.forEach((id) => vus.current!.add(id));
    if (nouvelles.length === 0 || !actif) return;

    const describe = (d: ClientRequest) => {
      const m = data.modules.find((x) => x.id === d.moduleId);
      const l = data.lignes.find((x) => x.id === d.ligneId);
      const c = l ? data.contrats.find((x) => x.id === l.contratId) : undefined;
      const quoi = d.type === "devis" ? d.offreTitre ?? "" : (d.moduleIds?.length ?? 0) > 1 ? `${d.moduleIds!.length} modules` : `module ${m?.numero ?? ""}`;
      return { titre: `${REQUEST_LABEL[d.type].label} · ${quoi}`, detail: [c?.reference, c?.client, c?.ville].filter(Boolean).join(" · ") };
    };

    setToasts((prev) => [...nouvelles.map((d) => ({ id: d.id, ...describe(d) })), ...prev].slice(0, 4));
    carillon();
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      for (const d of nouvelles) {
        const { titre, detail } = describe(d);
        try {
          const n = new Notification(`Loc and Go · ${titre}`, { body: detail || "Nouvelle demande client", tag: d.id });
          n.onclick = () => {
            window.focus();
            window.location.href = "/demandes";
          };
        } catch {
          /* notification refusée par le navigateur */
        }
      }
    }
  }, [data.demandes, data.modules, data.lignes, data.contrats, actif]);

  const basculer = async () => {
    const next = !actif;
    setActif(next);
    try {
      window.localStorage.setItem(PREF_KEY, next ? "on" : "off");
    } catch {
      /* stockage indisponible */
    }
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      setPermission(await Notification.requestPermission());
    }
    if (next) carillon();
  };

  const fermer = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return { toasts, fermer, actif, basculer, permission };
}

export function AlertToggle({ actif, permission, onToggle }: { actif: boolean; permission: NotificationPermission | "indisponible"; onToggle: () => void }) {
  const Icon = !actif ? BellOff : permission === "granted" ? BellRing : Bell;
  return (
    <button
      onClick={onToggle}
      className="mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      title={permission === "denied" ? "Les notifications sont bloquées dans les réglages du navigateur : seuls le bandeau et le son restent actifs." : undefined}
    >
      <Icon className="h-4 w-4 flex-none" />
      {actif ? (permission === "granted" ? "Alertes activées (son + notification)" : "Alertes activées (son)") : "Alertes désactivées"}
    </button>
  );
}

export function AlertToasts({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-lg ring-1 ring-slate-200">
          <BellRing className="mt-0.5 h-5 w-5 flex-none text-rose-600" />
          <Link href="/demandes" onClick={() => onClose(t.id)} className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Nouvelle demande · {t.titre}</p>
            {t.detail && <p className="truncate text-xs text-slate-500">{t.detail}</p>}
            <p className="mt-1 text-xs font-medium text-brand-600">Voir les demandes →</p>
          </Link>
          <button onClick={() => onClose(t.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
