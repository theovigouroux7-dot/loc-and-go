import "server-only";
import { NextResponse } from "next/server";
import { DbError } from "./db";

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function erreur(message: string, status = 400, extra: Record<string, unknown> = {}): NextResponse {
  return json({ error: message, ...extra }, status);
}

/** Enveloppe une route : les erreurs de base de données deviennent un message lisible. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(err);
      const message = err instanceof DbError ? err.message : "Erreur interne du serveur.";
      return erreur(message, 500);
    }
  };
}

export async function lireJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
