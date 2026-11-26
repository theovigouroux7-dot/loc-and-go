import type { NextRequest } from "next/server";
import { espaceDeSession, fermerSession, ouvrirSession } from "@/lib/server/auth";
import { dbReady, getEspace, LIMITE_ESSAI, updateEspace } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Espace connecté. */
export const GET = route(async (req: NextRequest) => {
  if (!dbReady) return erreur("Base en ligne non configurée (SUPABASE_SERVICE_ROLE_KEY).", 503);
  const e = await espaceDeSession(req);
  if (!e) return erreur("Non connecté.", 401);
  return json({ slug: e.slug, nom: e.nom, plan: e.plan, limiteMateriels: e.plan === "essai" ? LIMITE_ESSAI : null });
});

/** Connexion à un espace avec son code. */
export const POST = route(async (req: NextRequest) => {
  const body = await lireJson<{ slug?: string; code?: string }>(req);
  const slug = (body?.slug ?? "").trim().toLowerCase();
  const code = (body?.code ?? "").replace(/\s/g, "");
  if (!slug || !code) return erreur("Indiquez l'identifiant de l'espace et le code.");
  await new Promise((r) => setTimeout(r, 300)); // freine les essais en série
  const e = await getEspace(slug);
  if (!e || e.code !== code) return erreur("Identifiant ou code incorrect.", 401);
  await updateEspace(slug, { derniere_connexion: new Date().toISOString() });
  const res = json({ ok: true, slug });
  ouvrirSession(res, slug);
  return res;
});

/** Déconnexion. */
export const DELETE = route(async () => {
  const res = json({ ok: true });
  fermerSession(res);
  return res;
});
