import type { NextRequest } from "next/server";
import { adminConfigured, estAdmin, fermerAdmin, motDePasseAdminValide, ouvrirAdmin } from "@/lib/server/auth";
import { dbReady } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => json({ admin: estAdmin(req), configure: adminConfigured() && dbReady }));

export const POST = route(async (req: NextRequest) => {
  if (!adminConfigured()) return erreur("Ajoutez la variable ADMIN_PASSWORD dans Vercel.", 503);
  const body = await lireJson<{ motDePasse?: string }>(req);
  await new Promise((r) => setTimeout(r, 400));
  if (!motDePasseAdminValide(body?.motDePasse ?? "")) return erreur("Mot de passe incorrect.", 401);
  const res = json({ ok: true });
  ouvrirAdmin(res);
  return res;
});

export const DELETE = route(async () => {
  const res = json({ ok: true });
  fermerAdmin(res);
  return res;
});
