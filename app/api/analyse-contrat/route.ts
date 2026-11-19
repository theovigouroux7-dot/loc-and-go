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
  groupes: {
    type: string;
    designation: string;
    quantite: number;
    numeros: string[];
    equipements: { nom: string; quantite: number }[];
  }[];
}

function consignes(catalogue: string[], types: string[]): string {
  return `Tu lis un contrat de location de bâtiments modulaires (bungalows, conteneurs) et tu en extrais les informations pour pré-remplir un formulaire de préparation à l'atelier.

COMMENT EST FAIT CE CONTRAT
- En-tête : le loueur (par ex. BATILOC) n'est PAS le client. Le client est le nom sous « CONTRAT DE LOCATION » / « Adresse de facturation » (ex. VICAT SA, LOCA LOCA, SATMA).
- « N° CONTRAT » (ex. 03-008141) est la référence.
- « Adresse de livraison » est le chantier (souvent 1 ou 2 lignes : lieu-dit ou rue, puis code postal et ville).
- « Contact : … Tél. : … » donne le contact sur place.
- Le tableau a ces colonnes : N° LOCATION (code article ou numéro de module), DÉSIGNATION, QTÉ, valeurs, DATE DE DÉBUT LOCATION, DATE FIN DE LOC. PRÉVUE, LOYER.
- Une LIGNE DE MODULE a un code de bâtiment ou de conteneur (ex. BAT600, BAT600H, BAT600HX3, BAT600S, IR600H, BS20) ou bien un NUMÉRO de module (ex. 12824), une désignation (ex. « BATILOC 600 H - modules aménagés en SALLE DE CLASSE ») et une quantité.
- Les lignes qui suivent une ligne de module, jusqu'à la ligne de module suivante, sont SES équipements : TABLE, CHAISE, CLIM, ARMVEST (armoire vestiaire), BANC, KITCHENET (kitchenette), AUTREMATERIEL (BAES, fenêtre intérieure, alarme…). Leur quantité est le TOTAL pour toute la ligne de module (ex. 28 modules et 7 alarmes).
- Attention : le code ne dit pas toujours ce qu'est l'équipement. Prends le nom dans la DÉSIGNATION (ex. code CLIM avec désignation « Alarme incendie » = « Alarme incendie », pas une climatisation).

À IGNORER COMPLÈTEMENT (ce ne sont ni des modules ni des équipements)
- Transport aller et retour (TRANSA, TRANSR), montage (MONTAGE), démontage (DEMONTAGE), nettoyage (NETTOYAGER), assurances, consignes, prix, loyers, conditions générales, mentions du loueur.

À METTRE DANS "notes" (court, utile à l'atelier et au chauffeur)
- Le contact sur place et son téléphone.
- Le matériel livré qui n'appartient à aucune ligne de module, placé après les modules (ex. AUTREMATERIEL « Rampe d'accès PMR » × 4, « Escaliers » × 1) : écris « Matériel à livrer : 4 rampes d'accès PMR, 1 escalier ».
- Les remarques importantes pour l'installation (ex. « chaque module possède son propre tableau électrique », « voir plan ci-joint », « R+1 »). N'inclus pas « Restant à votre charge » ni les délais de disponibilité.

PROLONGATION
- Si le contrat est une prolongation (« PROLONGATION DE CONTRAT »), mets "prolongation": true : les modules sont déjà chez le client.

FORMAT DE RÉPONSE
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{
  "reference": "N° CONTRAT",
  "client": "nom du client",
  "adresse": "adresse de livraison sans le code postal ni la ville, ou chaîne vide",
  "ville": "ville de livraison (sans le code postal)",
  "dateLivraison": "AAAA-MM-JJ : DATE DE DÉBUT LOCATION des modules",
  "dateFin": "AAAA-MM-JJ : DATE FIN DE LOC. PRÉVUE des modules, ou chaîne vide",
  "notes": "texte court ou chaîne vide",
  "prolongation": false,
  "groupes": [
    {
      "type": "type du module",
      "designation": "désignation complète, sur une ligne, sans les prix",
      "quantite": nombre de modules,
      "numeros": ["numéros de module si la colonne N° LOCATION contient un numéro, sinon liste vide"],
      "equipements": [ { "nom": "nom de l'équipement", "quantite": quantité totale du groupe } ]
    }
  ]
}

RÈGLES POUR LES NOMS
- "type" : si l'un de ces types du parc correspond, reprends-le exactement : ${types.length ? types.join(", ") : "(aucun type enregistré)"}. Sinon, utilise le code du module (ex. BAT600H, IR600H, BS20).
- Équipements : si l'un de ces noms correspond, reprends-le exactement : ${catalogue.join(", ")}. Sinon, garde un nom court tiré de la désignation (ex. « Alarme incendie », « BAES », « Fenêtre intérieure »).
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
  const service = /transport|montage|d[ée]montage|nettoyage|livraison|grutage/i;
  return {
    reference: str(brut.reference),
    client: str(brut.client),
    adresse: str(brut.adresse),
    ville: str(brut.ville),
    dateLivraison: date(brut.dateLivraison),
    dateFin: date(brut.dateFin),
    notes: str(brut.notes),
    prolongation: brut.prolongation === true,
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
