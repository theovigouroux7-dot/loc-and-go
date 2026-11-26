import type { NextRequest } from "next/server";
import { estAdmin, nouveauCode, ouvrirSession } from "@/lib/server/auth";
import { deleteEspace, ESPACE_PRINCIPAL, getEspace, updateEspace, type Espace } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: { slug: string } };

/** Renommer, changer de version, ou générer un nouveau code. */
export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  if (!estAdmin(req)) return erreur("Accès réservé.", 401);
  const b = await lireJson<{ nom?: string; plan?: string; nouveauCode?: boolean }>(req);
  const patch: Partial<Espace> = {};
  if (typeof b?.nom === "string") patch.nom = b.nom.trim().slice(0, 120);
  if (b?.plan === "essai" || b?.plan === "complet") patch.plan = b.plan;
  if (b?.nouveauCode) patch.code = nouveauCode();
  await updateEspace(params.slug, patch);
  return json({ ok: true, ...patch });
});

export const DELETE = route(async (req: NextRequest, { params }: Ctx) => {
  if (!estAdmin(req)) return erreur("Accès réservé.", 401);
  if (params.slug === ESPACE_PRINCIPAL) return erreur("L'espace principal ne peut pas être supprimé.");
  await deleteEspace(params.slug);
  return json({ ok: true });
});

/** Ouvre l'espace dans ce navigateur (connexion directe, sans code). */
export const POST = route(async (req: NextRequest, { params }: Ctx) => {
  if (!estAdmin(req)) return erreur("Accès réservé.", 401);
  if (!(await getEspace(params.slug))) return erreur("Espace introuvable.", 404);
  const res = json({ ok: true });
  ouvrirSession(res, params.slug);
  return res;
});
