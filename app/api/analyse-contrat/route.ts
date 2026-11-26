import { NextResponse } from "next/server";

// Analyse d'un contrat de location (PDF ou photo) par Claude.
// La clé ANTHROPIC_API_KEY est lue côté serveur (variables d'environnement Vercel) et n'est jamais envoyée au navigateur.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_BYTES = 4 * 1024 * 1024; // limite d'envoi des fonctions Vercel : ~4,5 Mo

interface ResultatAnalyse {
  reference: string;
  client: string;
  adresse: string;
  ville: string;
  dateLivraison: string;
  dateFin: string;
  notes: string;
  prolongation: boolean;
  accessoires: { nom: string; quantite: number }[];
  groupes: {
    type: string;
    designation: string;
    quantite: number;
    numeros: string[];
    equipements: { nom: string; quantite: number }[];
  }[];
}

function consignes(catalogue: string[], types: string[]): string {
  return `Tu lis un contrat de location de matériel (bâtiments modulaires, nacelles, engins de chantier, groupes électrogènes, échafaudages… selon le loueur) et tu en extrais les informations pour pré-remplir un formulaire de préparation à l'atelier.

COMMENT LIRE LE CONTRAT
- Le loueur (en-tête, logo, mentions légales) n'est PAS le client. Le client est le locataire : nom sous « Contrat de location », « Locataire », « Client » ou « Adresse de facturation ».
- La référence est le numéro du contrat (« N° contrat », « N° de location », « Bon de location »…).
- Le chantier est l'adresse de livraison ou d'utilisation (souvent : rue ou lieu-dit, puis code postal et ville).
- Un contact sur place avec son téléphone est souvent indiqué.
- Le tableau liste le matériel loué. Une LIGNE DE MATÉRIEL décrit un matériel loué : un code article ou un numéro de parc, une désignation (ex. « Bureau 6 x 2,44 m », « Nacelle articulée 16 m », « Mini-pelle 2,5 t », « Groupe électrogène 100 kVA ») et une quantité.
- Les lignes qui suivent une ligne de matériel et décrivent ce qui est fourni AVEC lui (mobilier, options, accessoires montés : tables, chaises, climatisation, godet, harnais, flexibles…), jusqu'à la ligne de matériel suivante, sont SES éléments fournis. Leur quantité est le TOTAL pour toute la ligne (ex. 28 bureaux et 7 alarmes).
- Le code article ne dit pas toujours ce qu'est l'élément : prends le nom dans la DÉSIGNATION (ex. code CLIM avec désignation « Alarme incendie » = « Alarme incendie »).
- Exemple de contrat de modulaire : codes BAT600, BAT600H, BS20 pour les bâtiments, puis TABLE, CHAISE, CLIM, ARMVEST, KITCHENET… pour leurs éléments fournis.

À IGNORER COMPLÈTEMENT (ce ne sont ni du matériel ni des éléments fournis)
- Transport aller et retour, livraison, enlèvement, montage, démontage, grutage, nettoyage, carburant facturé, forfaits, assurances, consignes, prix, loyers, conditions générales, mentions du loueur.

ACCESSOIRES (liste "accessoires")
- Le matériel livré qui n'est rattaché à aucune ligne de matériel, en général placé à la fin (ex. rampe d'accès PMR, escalier, passerelle, garde-corps, plaques de roulage) : un élément par ligne, avec son nom court et sa quantité. Ne les mets pas dans les notes.
- Ce qui est placé sous une ligne de matériel reste un élément fourni de ce matériel, pas un accessoire.

À METTRE DANS "notes" (court, utile à l'atelier et au chauffeur)
- Le contact sur place et son téléphone.
- Les remarques importantes pour la livraison ou l'installation (accès, horaires, « voir plan ci-joint », « R+1 »…). Pas les conditions commerciales.

PROLONGATION
- Si le contrat est une prolongation, mets "prolongation": true : le matériel est déjà chez le client.

FORMAT DE RÉPONSE
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{
  "reference": "numéro du contrat",
  "client": "nom du client",
  "adresse": "adresse de livraison sans le code postal ni la ville, ou chaîne vide",
  "ville": "ville de livraison (sans le code postal)",
  "dateLivraison": "AAAA-MM-JJ : date de début de location",
  "dateFin": "AAAA-MM-JJ : date de fin de location prévue, ou chaîne vide",
  "notes": "texte court ou chaîne vide",
  "prolongation": false,
  "accessoires": [ { "nom": "nom court (ex. Rampe d'accès PMR, Escalier)", "quantite": nombre } ],
  "groupes": [
    {
      "type": "type du matériel",
      "designation": "désignation complète, sur une ligne, sans les prix",
      "quantite": nombre de matériels de ce groupe,
      "numeros": ["numéros de parc si le contrat les indique, sinon liste vide"],
      "equipements": [ { "nom": "nom de l'élément fourni", "quantite": quantité totale du groupe } ]
    }
  ]
}

RÈGLES POUR LES NOMS
- "type" : si l'un de ces types du parc correspond, reprends-le exactement : ${types.length ? types.join(", ") : "(aucun type enregistré)"}. Sinon, utilise le code article ou un nom court tiré de la désignation.
- Éléments fournis : si l'un de ces noms correspond, reprends-le exactement : ${catalogue.length ? catalogue.join(", ") : "(aucun élément configuré)"}. Sinon, garde un nom court tiré de la désignation.
- N'invente rien : chaîne vide ou liste vide si l'information n'est pas sur le document.`;
}

function extraireJson(texte: string): ResultatAnalyse {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin < debut) throw new Error("Réponse illisible");
  const brut = JSON.parse(texte.slice(debut, fin + 1));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "");
  const nb = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  // Filet de sécurité : on retire tout ce qui ressemble encore à du transport ou du montage.
  const service = /transport|montage|d[ée]montage|nettoyage|livraison|enl[èe]vement|grutage|forfait|assurance/i;
  return {
    reference: str(brut.reference),
    client: str(brut.client),
    adresse: str(brut.adresse),
    ville: str(brut.ville),
    dateLivraison: date(brut.dateLivraison),
    dateFin: date(brut.dateFin),
    notes: str(brut.notes),
    prolongation: brut.prolongation === true,
    accessoires: (Array.isArray(brut.accessoires) ? brut.accessoires : [])
      .map((a: Record<string, unknown>) => ({ nom: str(a.nom), quantite: nb(a.quantite) }))
      .filter((a: { nom: string; quantite: number }) => a.nom && a.quantite > 0 && !service.test(a.nom)),
    groupes: (Array.isArray(brut.groupes) ? brut.groupes : [])
      .map((g: Record<string, unknown>) => ({
        type: str(g.type),
        designation: str(g.designation),
        quantite: Math.max(1, nb(g.quantite)),
        numeros: (Array.isArray(g.numeros) ? g.numeros : []).map((n: unknown) => str(String(n ?? ""))).filter(Boolean),
        equipements: (Array.isArray(g.equipements) ? g.equipements : [])
          .map((e: Record<string, unknown>) => ({ nom: str(e.nom), quantite: nb(e.quantite) }))
          .filter((e: { nom: string; quantite: number }) => e.nom && e.quantite > 0 && !service.test(e.nom)),
      }))
      .filter((g: { type: string; designation: string }) => (g.type || g.designation) && !service.test(`${g.type} ${g.designation}`)),
  };
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "L'analyse n'est pas configurée : ajoutez la variable ANTHROPIC_API_KEY dans Vercel (Settings > Environment Variables), puis redéployez." },
      { status: 501 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Fichier non reçu." }, { status: 400 });
  }
  const file = form.get("fichier");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier envoyé." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop lourd (4 Mo maximum)." }, { status: 413 });

  const catalogue = JSON.parse(String(form.get("catalogue") ?? "[]")) as string[];
  const types = JSON.parse(String(form.get("types") ?? "[]")) as string[];
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const imageType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) ? file.type : "image/jpeg";
  const piece = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: imageType, data } };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        messages: [{ role: "user", content: [piece, { type: "text", text: consignes(catalogue, types) }] }],
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      const detail = body?.error?.message ?? res.statusText;
      const msg =
        res.status === 401
          ? "Clé API Anthropic refusée : vérifiez ANTHROPIC_API_KEY dans Vercel."
          : res.status === 400 && /credit/i.test(detail)
            ? "Crédit Anthropic épuisé : rechargez votre compte sur la console Anthropic."
            : `L'analyse a échoué (${res.status}) : ${detail}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    const texte = (body.content ?? [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join("\n");
    return NextResponse.json({ resultat: extraireJson(texte) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Le contrat n'a pas pu être lu. Réessayez, ou remplissez le formulaire à la main." }, { status: 502 });
  }
}
