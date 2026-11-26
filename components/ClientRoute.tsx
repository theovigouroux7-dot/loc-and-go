"use client";

import ClientModulePage from "@/components/ClientPage";
import { StoreProvider } from "@/lib/store";
import { StoreReady } from "@/app/providers";

/** Page ouverte par le QR code : seules les données du contrat de ce matériel sont chargées. */
export function ClientRoute({ slug, moduleId }: { slug: string; moduleId: string }) {
  return (
    <StoreProvider scope={{ mode: "public", slug, moduleId }}>
      <StoreReady>
        <ClientModulePage moduleId={moduleId} />
      </StoreReady>
    </StoreProvider>
  );
}
