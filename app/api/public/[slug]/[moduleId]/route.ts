import type { NextRequest } from "next/server";
import { getEspace, upsertRows, type Row } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";
import { filtrerEcritures, sousEnsemble } from "@/lib/server/public";

export const dynamic = "force-dynamic";
type Ctx = { params: { slug: string; moduleId: string } };

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const e = await getEspace(params.slug);
  if (!e) return erreur("Espace introuvable.", 404);
  const s = await sousEnsemble(e, params.moduleId);
  return json({ rows: s.rows, espace: { slug: e.slug, plan: e.plan } });
});

export const POST = route(async (req: NextRequest, { params }: Ctx) => {
  const e = await getEspace(params.slug);
  if (!e) return erreur("Espace introuvable.", 404);
  const body = await lireJson<{ rows?: Row[] }>(req);
  const rows = await filtrerEcritures(e, params.moduleId, body?.rows ?? []);
  if (rows.length) await upsertRows(e.slug, rows);
  return json({ ok: true, acceptes: rows.length });
});
