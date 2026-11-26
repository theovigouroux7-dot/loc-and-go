// Sessions signées dans un cookie : pas de compte, un espace = un lien + un code.
import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getEspace, dbReady, type Espace } from "./db";

const SESSION = "lg_session";
const ADMIN = "lg_admin";
const DUREE_ESPACE = 60 * 60 * 24 * 90; // 90 jours
const DUREE_ADMIN = 60 * 60 * 12; // 12 heures

function secret(): string {
  return process.env.LOCANDGO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_PASSWORD || "loc-and-go-dev";
}

function signer(valeur: string): string {
  return createHmac("sha256", secret()).update(valeur).digest("base64url");
}

function jeton(sujet: string, duree: number): string {
  const exp = Math.floor(Date.now() / 1000) + duree;
  const corps = `${sujet}.${exp}`;
  return `${corps}.${signer(corps)}`;
}

function lireJeton(valeur: string | undefined): string | null {
  if (!valeur) return null;
  const i = valeur.lastIndexOf(".");
  if (i < 0) return null;
  const corps = valeur.slice(0, i);
  const sig = Buffer.from(valeur.slice(i + 1));
  const attendu = Buffer.from(signer(corps));
  if (sig.length !== attendu.length || !timingSafeEqual(sig, attendu)) return null;
  const j = corps.lastIndexOf(".");
  const exp = Number(corps.slice(j + 1));
  if (!exp || exp < Date.now() / 1000) return null;
  return corps.slice(0, j);
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export function ouvrirSession(res: NextResponse, slug: string): void {
  res.cookies.set(SESSION, jeton(slug, DUREE_ESPACE), cookieOptions(DUREE_ESPACE));
}

export function fermerSession(res: NextResponse): void {
  res.cookies.set(SESSION, "", cookieOptions(0));
}

export function slugDeSession(req: NextRequest): string | null {
  return lireJeton(req.cookies.get(SESSION)?.value);
}

/** Espace connecté, ou null. */
export async function espaceDeSession(req: NextRequest): Promise<Espace | null> {
  const slug = slugDeSession(req);
  if (!slug || !dbReady) return null;
  return (await getEspace(slug)) ?? null;
}

// --- Admin -------------------------------------------------------------------------------

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

export function motDePasseAdminValide(mdp: string): boolean {
  const attendu = process.env.ADMIN_PASSWORD ?? "";
  if (!attendu) return false;
  const a = Buffer.from(mdp);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function ouvrirAdmin(res: NextResponse): void {
  res.cookies.set(ADMIN, jeton("admin", DUREE_ADMIN), cookieOptions(DUREE_ADMIN));
}

export function fermerAdmin(res: NextResponse): void {
  res.cookies.set(ADMIN, "", cookieOptions(0));
}

export function estAdmin(req: NextRequest): boolean {
  return lireJeton(req.cookies.get(ADMIN)?.value) === "admin";
}

// --- Générateurs -------------------------------------------------------------------------

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // sans 0/o/1/l/i, pour éviter les confusions

export function nouveauSlug(): string {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function nouveauCode(): string {
  return String(randomInt(1_000_000)).padStart(6, "0");
}
