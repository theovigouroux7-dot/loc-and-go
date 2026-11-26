// Vocabulaire du loueur : chacun appelle son matériel à sa façon (module, machine, engin…).
// Toutes les phrases de l'application passent par ces formes, accordées en genre et avec l'élision.

export interface Terme {
  singulier: string; // « matériel », « machine », « engin »
  pluriel: string; // « matériels », « machines », « engins »
  feminin: boolean;
}

export const TERME_DEFAUT: Terme = { singulier: "matériel", pluriel: "matériels", feminin: false };
export const TERME_MODULE: Terme = { singulier: "module", pluriel: "modules", feminin: false };

export const TERMES_PROPOSES: Terme[] = [
  TERME_DEFAUT,
  TERME_MODULE,
  { singulier: "machine", pluriel: "machines", feminin: true },
  { singulier: "engin", pluriel: "engins", feminin: false },
  { singulier: "bungalow", pluriel: "bungalows", feminin: false },
  { singulier: "conteneur", pluriel: "conteneurs", feminin: false },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const voyelle = (s: string) => /^[aeiouyhàâéèêëîïôöûü]/i.test(s);

export interface Termes {
  s: string; // matériel
  p: string; // matériels
  S: string; // Matériel
  P: string; // Matériels
  un: string; // un matériel / une machine
  Un: string;
  le: string; // le matériel / la machine / l'engin
  Le: string;
  les: string; // les matériels
  Les: string;
  du: string; // du matériel / de la machine / de l'engin
  au: string; // au matériel / à la machine / à l'engin
  ce: string; // ce matériel / cette machine / cet engin
  Ce: string;
  de: string; // de matériel / de machine / d'engin (sans article)
  deP: string; // de matériels / d'engins
  e: string; // accord des adjectifs : "" ou "e"
  aucun: string; // aucun / aucune
  Aucun: string;
  n: (k: number) => string; // « 1 matériel », « 3 matériels »
}

export function termes(t: Terme | undefined): Termes {
  const { singulier: s, pluriel: p, feminin: f } = t && t.singulier ? t : TERME_DEFAUT;
  const v = voyelle(s);
  const le = v ? `l'${s}` : f ? `la ${s}` : `le ${s}`;
  const un = f ? `une ${s}` : `un ${s}`;
  const ce = f ? `cette ${s}` : v ? `cet ${s}` : `ce ${s}`;
  const de = v ? `d'${s}` : `de ${s}`;
  const deP = voyelle(p) ? `d'${p}` : `de ${p}`;
  const du = v ? `de l'${s}` : f ? `de la ${s}` : `du ${s}`;
  const au = v ? `à l'${s}` : f ? `à la ${s}` : `au ${s}`;
  return {
    s,
    p,
    S: cap(s),
    P: cap(p),
    un,
    Un: cap(un),
    le,
    Le: cap(le),
    les: `les ${p}`,
    Les: `Les ${p}`,
    du,
    au,
    ce,
    Ce: cap(ce),
    de,
    deP,
    e: f ? "e" : "",
    aucun: f ? "aucune" : "aucun",
    Aucun: f ? "Aucune" : "Aucun",
    n: (k: number) => `${k} ${k > 1 ? p : s}`,
  };
}
