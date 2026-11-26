import type { NextRequest } from "next/server";
import { getEspace, getPhoto, putPhoto } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: { slug: string } };
const MAX = 8 * 1024 * 1024;

export const GET = route(async (req: NextRequest, { params }: Ctx) => {
  const e = await getEspace(params.slug);
  if (!e) return erreur("Espace introuvable.", 404);
  return json({ data: (await getPhoto(e.slug, req.nextUrl.searchParams.get("id") ?? "")) ?? null });
});

export const POST = route(async (req: NextRequest, { params }: Ctx) => {
  const e = await getEspace(params.slug);
  if (!e) return erreur("Espace introuvable.", 404);
  const body = await lireJson<{ id?: string; data?: string }>(req);
  // Les photos envoyées par le client (SAV, réserves) ont toujours un identifiant neuf.
  if (!body?.id || !body.id.startsWith("ph") || typeof body.data !== "string" || body.data.length > MAX) return erreur("Photo invalide.");
  if (await getPhoto(e.slug, body.id)) return erreur("Photo déjà existante.", 409);
  await putPhoto(e.slug, body.id, body.data);
  return json({ ok: true });
});
