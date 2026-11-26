import type { NextRequest } from "next/server";
import { espaceDeSession } from "@/lib/server/auth";
import { getPhoto, putPhoto, removePhoto } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
const MAX = 8 * 1024 * 1024;

export const GET = route(async (req: NextRequest) => {
  const e = await espaceDeSession(req);
  if (!e) return erreur("Non connecté.", 401);
  const id = req.nextUrl.searchParams.get("id") ?? "";
  return json({ data: (await getPhoto(e.slug, id)) ?? null });
});

export const POST = route(async (req: NextRequest) => {
  const e = await espaceDeSession(req);
  if (!e) return erreur("Non connecté.", 401);
  const body = await lireJson<{ id?: string; data?: string }>(req);
  if (!body?.id || typeof body.data !== "string" || body.data.length > MAX) return erreur("Photo invalide.");
  await putPhoto(e.slug, body.id, body.data);
  return json({ ok: true });
});

export const DELETE = route(async (req: NextRequest) => {
  const e = await espaceDeSession(req);
  if (!e) return erreur("Non connecté.", 401);
  await removePhoto(e.slug, req.nextUrl.searchParams.get("id") ?? "");
  return json({ ok: true });
});
