import type { NextRequest } from "next/server";
import { estAdmin } from "@/lib/server/auth";
import { updateDemo } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const PATCH = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  if (!estAdmin(req)) return erreur("Accès réservé.", 401);
  const b = await lireJson<{ traitee?: boolean }>(req);
  await updateDemo(params.id, { traitee: Boolean(b?.traitee) });
  return json({ ok: true });
});
