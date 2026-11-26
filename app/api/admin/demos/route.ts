import type { NextRequest } from "next/server";
import { estAdmin } from "@/lib/server/auth";
import { listDemos } from "@/lib/server/db";
import { erreur, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  if (!estAdmin(req)) return erreur("Accès réservé.", 401);
  return json({ demos: await listDemos() });
});
