import { NextResponse, type NextRequest } from "next/server";
import { espaceDeSession } from "@/lib/server/auth";
import { dbReady } from "@/lib/server/db";

// Reconnaissance par Claude de la structure d'un fichier Excel de parc : feuille, ligne des titres, colonnes.
// Seules les premières lignes de chaque feuille sont envoyées ; l'application applique ensuite la correspondance à tout le fichier.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const CHAMPS = ["numero", "type", "dimensions", "equipements", "depot", "statut", "contrat", "client", "ville", "dateFin"] as const;

interface Feuille {
  nom: string;
  lignes: string[][];
}

function consignes(feuilles: Feuille[]): string {
  const apercu = feuilles
    .map(
      (f) =>
        `### Feuille « ${f.nom} »\n` +
        f.lignes.map((l, i) => `Ligne ${i} : ${l.map((c, j) => `[${j}] ${c}`).join(" | ")}`).join("\n"),
    )
    .join("\n\n");

  return `Voici le début d'un fichier Excel exporté par un loueur de matériel (bâtiments modulaires, nacelles, engins, groupes électrogènes, échafaudages…). Il doit contenir la liste de son parc : un matériel par ligne.

${apercu}

Trouve :
1. La feuille qui contient la liste du matériel.
2. L'index de la ligne des titres de colonnes dans cette feuille (0 = première ligne affichée).
3. Pour chaque information ci-dessous, l'index de la colonne qui la contient, ou -1 si elle n'existe pas :
- "numero" : numéro de parc, numéro interne, numéro de série ou immatriculation (OBLIGATOIRE : l'identifiant unique de chaque matériel, souvent un nombre ou un code comme 20412 ou NAC-016 ; pas le code article générique qui se répète d'une ligne à l'autre).
- "type" : type, modèle ou désignation (ex. bureau, sanitaire, conteneur 20 pieds, nacelle articulée 16 m, mini-pelle 2,5 t). Si deux colonnes conviennent, préfère la plus courte et la plus parlante.
- "dimensions" : caractéristiques techniques (dimensions, surface, hauteur de travail, puissance, capacité).
- "equipements" : équipements, options, accessoires ou aménagement.
- "depot" : agence, dépôt, site de stockage ou emplacement au parc.
- "statut" : colonne qui indique si le matériel est en location, disponible ou en réparation (ex. « En loc », « Loué », « Dispo », « En réparation »), même sans numéro de contrat.
- "contrat" : numéro du contrat de location en cours (vide quand le matériel est disponible).
- "client" : client ou locataire actuel.
- "ville" : ville ou adresse du chantier actuel.
- "dateFin" : date de fin de location prévue.

Une même colonne ne peut servir qu'à une seule information. N'invente rien.
Remarque : une désignation peut se poursuivre sur la ligne suivante, sans numéro (ex. « ballustrades » sous la ligne du matériel) ; l'application recolle ces lignes toute seule, ne t'en préoccupe pas.

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{ "feuille": "nom exact de la feuille", "ligneTitres": 0, "colonnes": { "numero": 0, "type": 1, "dimensions": -1, "equipements": -1, "depot": -1, "statut": -1, "contrat": -1, "client": -1, "ville": -1, "dateFin": -1 }, "remarque": "une phrase en français pour le loueur : ce que tu as reconnu et ce qui manque éventuellement" }`;
}

export async function POST(req: NextRequest) {
  // Espaces en ligne : l'analyse par Claude est réservée à la version complète.
  if (dbReady) {
    const espace = await espaceDeSession(req);
    if (!espace) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    if (espace.plan !== "complet") return NextResponse.json({ error: "Fonction réservée à la version complète.", verrou: true }, { status: 403 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Analyse indisponible : ANTHROPIC_API_KEY n'est pas configurée dans Vercel." }, { status: 501 });
  }
  let feuilles: Feuille[];
  try {
    const body = (await req.json()) as { feuilles?: Feuille[] };
    feuilles = (body.feuilles ?? []).slice(0, 6).map((f) => ({
      nom: String(f.nom).slice(0, 80),
      lignes: (f.lignes ?? []).slice(0, 40).map((l) => (l ?? []).slice(0, 30).map((c) => String(c ?? "").slice(0, 60))),
    }));
  } catch {
    return NextResponse.json({ error: "Données illisibles." }, { status: 400 });
  }
  if (feuilles.length === 0) return NextResponse.json({ error: "Fichier vide." }, { status: 400 });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: "user", content: consignes(feuilles) }] }),
    });
    const body = await res.json();
    if (!res.ok) {
      const detail = body?.error?.message ?? res.statusText;
      return NextResponse.json({ error: `L'analyse a échoué (${res.status}) : ${detail}` }, { status: 502 });
    }
    const texte = (body.content ?? [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join("\n");
    const brut = JSON.parse(texte.slice(texte.indexOf("{"), texte.lastIndexOf("}") + 1));
    const feuille = feuilles.find((f) => f.nom === brut.feuille)?.nom ?? feuilles[0].nom;
    const nbCols = Math.max(...(feuilles.find((f) => f.nom === feuille)?.lignes.map((l) => l.length) ?? [0]));
    const colonnes: Record<string, number> = {};
    const prises = new Set<number>();
    for (const champ of CHAMPS) {
      const v = Math.round(Number(brut.colonnes?.[champ]));
      if (Number.isFinite(v) && v >= 0 && v < Math.max(nbCols, 30) && !prises.has(v)) {
        colonnes[champ] = v;
        prises.add(v);
      }
    }
    return NextResponse.json({
      resultat: {
        feuille,
        ligneTitres: Math.max(0, Math.min(39, Math.round(Number(brut.ligneTitres) || 0))),
        colonnes,
        remarque: typeof brut.remarque === "string" ? brut.remarque.slice(0, 400) : "",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "La structure du fichier n'a pas pu être reconnue." }, { status: 502 });
  }
}
