"use client";

import { AppShell } from "@/components/AppShell";
import { EspaceGate, useEspace } from "@/components/Espace";
import { StoreProvider } from "@/lib/store";
import { StoreReady } from "../providers";

function EspaceStore({ children }: { children: React.ReactNode }) {
  const espace = useEspace();
  return (
    <StoreProvider limiteMateriels={espace.limiteMateriels}>
      <StoreReady>
        <AppShell>{children}</AppShell>
      </StoreReady>
    </StoreProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <EspaceGate>
      <EspaceStore>{children}</EspaceStore>
    </EspaceGate>
  );
}
