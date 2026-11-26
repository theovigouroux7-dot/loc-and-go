import type { NextRequest } from "next/server";
import { estAdmin, nouveauCode, nouveauSlug } from "@/lib/server/auth";
import { countModulesParEspace, insertEspaces, listEspaces, type Espace, type Plan } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  if (!estAdmin(req)) return erreur("Accès réservé.", 401);
  const [espaces, comptes] = await Promise.all([listEspaces(), countModulesParEspace()]);
  return json({ espaces: espaces.map((e) => ({ ...e, materiels: comptes[e.slug] ?? 0 })) });
});

/** Crée des espaces en lot (ex. 100 espaces d'essai). */
export const POST = route(async (req: NextRequest) => {
  if (!estAdmin(req)) return erreur("Accès réservé.", 401);
  const b = await lireJson<{ nombre?: number; plan?: Plan; prefixe?: string }>(req);
  const nombre = Math.min(500, Math.max(1, Math.floor(Number(b?.nombre) || 1)));
  const plan: Plan = b?.plan === "complet" ? "complet" : "essai";
  const prefixe = (b?.prefixe ?? "").trim().slice(0, 60);
  const existants = new Set((await listEspaces()).map((e) => e.slug));
  const nouveaux: Espace[] = [];
  const debut = existants.size;
  while (nouveaux.length < nombre) {
    const slug = nouveauSlug();
    if (existants.has(slug)) continue;
    existants.add(slug);
    const n = nouveaux.length + 1;
    nouveaux.push({ slug, code: nouveauCode(), plan, nom: prefixe ? (nombre > 1 ? `${prefixe} ${n}` : prefixe) : `Espace ${debut + n}` });
  }
  await insertEspaces(nouveaux);
  return json({ ok: true, crees: nouveaux.length });
});
