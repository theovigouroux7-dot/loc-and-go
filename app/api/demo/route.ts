import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { slugDeSession } from "@/lib/server/auth";
import { dbReady, insertDemo } from "@/lib/server/db";
import { erreur, json, lireJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Demande de démo envoyée depuis la page de présentation ou depuis un espace d'essai. */
export const POST = route(async (req: NextRequest) => {
  if (!dbReady) return erreur("Demande impossible pour le moment : la base en ligne n'est pas configurée.", 503);
  const b = await lireJson<Record<string, string>>(req);
  const champ = (k: string, max = 200) => String(b?.[k] ?? "").trim().slice(0, max);
  const demo = {
    id: randomUUID(),
    nom: champ("nom"),
    societe: champ("societe"),
    telephone: champ("telephone", 40),
    email: champ("email"),
    message: champ("message", 2000),
    espace: slugDeSession(req) ?? "",
    traitee: false,
  };
  if (!demo.nom || (!demo.telephone && !demo.email)) return erreur("Indiquez votre nom et un téléphone ou un e-mail.");
  await insertDemo(demo);
  return json({ ok: true });
});
