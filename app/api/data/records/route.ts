import type { NextRequest } from "next/server";
import { espaceDeSession } from "@/lib/server/auth";
import { deleteAllData, fetchRows, LIMITE_ESSAI, moduleIds, upsertRows, type Row } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const KINDS = new Set(["module", "contrat", "ligne", "demande", "event", "rdv", "commentaire", "settings", "tombstone"]);

export const GET = route(async (req: NextRequest) => {
  const e = await espaceDeSession(req);
  if (!e) return erreur("Non connecté.", 401);
  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  return json({ rows: await fetchRows(e.slug, since) });
});

export const POST = route(async (req: NextRequest) => {
  const e = await espaceDeSession(req);
  if (!e) return erreur("Non connecté.", 401);
  const body = await lireJson<{ rows?: Row[] }>(req);
  const rows = (body?.rows ?? []).filter((r) => r && typeof r.id === "string" && r.id.length < 200 && KINDS.has(r.kind));
  if (rows.length === 0) return json({ ok: true });

  // Version d'essai : 50 matériels (donc 50 QR codes) au maximum.
  if (e.plan === "essai" && rows.some((r) => r.kind === "module")) {
    const ids = new Set(await moduleIds(e.slug));
    const avant = ids.size;
    for (const r of rows) if (r.kind === "module") ids.add(r.id);
    for (const r of rows) if (r.kind === "tombstone") ids.delete(r.id);
    if (ids.size > LIMITE_ESSAI && ids.size > avant) {
      return erreur(`Version d'essai : ${LIMITE_ESSAI} QR codes au maximum.`, 403, { limite: true });
    }
  }
  await upsertRows(e.slug, rows);
  return json({ ok: true });
});

export const DELETE = route(async (req: NextRequest) => {
  const e = await espaceDeSession(req);
  if (!e) return erreur("Non connecté.", 401);
  await deleteAllData(e.slug);
  return json({ ok: true });
});
