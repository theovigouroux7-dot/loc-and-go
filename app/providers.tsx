"use client";

import { Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";

/** Attend que les données soient chargées. */
export function StoreReady({ children }: { children: React.ReactNode }) {
  const { ready } = useStore();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
