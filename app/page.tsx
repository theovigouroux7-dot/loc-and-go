import {
  ArrowRight,
  CalendarDays,
  Camera,
  ClipboardCheck,
  FileSpreadsheet,
  LifeBuoy,
  PenLine,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { DemoForm } from "@/components/Demo";

export const metadata = {
  title: "Loc and Go · Le suivi de votre parc de location par QR code",
};

const FONCTIONS = [
  {
    icon: QrCode,
    titre: "Un QR code sur chaque matériel",
    texte: "Imprimez vos plaques en une fois. Chaque bungalow, nacelle ou engin a sa fiche, son historique et son statut en temps réel.",
  },
  {
    icon: ClipboardCheck,
    titre: "Préparation atelier sans papier",
    texte: "Le technicien scanne, prend les photos de départ, coche les points de contrôle et signe sur son téléphone.",
  },
  {
    icon: PenLine,
    titre: "Réception signée par le client",
    texte: "Sur le chantier, le client scanne le QR code, vérifie le matériel livré et signe. Ses réserves arrivent au bureau.",
  },
  {
    icon: LifeBuoy,
    titre: "SAV et retours en un scan",
    texte: "Une panne, une fin de chantier ? Le client déclare le SAV ou demande le retour depuis le QR code, photos à l'appui.",
  },
  {
    icon: CalendarDays,
    titre: "Planning partagé",
    texte: "Livraisons, retours, fins de contrat et vos propres rendez-vous, au même endroit, avec des commentaires pour l'équipe.",
  },
  {
    icon: Camera,
    titre: "Constat de retour",
    texte: "Photos de départ et de retour côte à côte : les dégâts et les manques sont constatés, datés et rattachés au contrat.",
  },
];

const ETAPES = [
  { n: "1", titre: "Importez votre parc", texte: "Depuis l'export Excel de votre logiciel actuel ou une simple liste de numéros. Les QR codes sont prêts à imprimer." },
  { n: "2", titre: "Collez les plaques", texte: "Une plaque par matériel. Pas d'application à installer : un téléphone suffit, pour vous comme pour vos clients." },
  { n: "3", titre: "Scannez à chaque étape", texte: "Préparation, livraison, réception, SAV, retour : tout est tracé, et le bureau voit tout en direct." },
];

export default function Accueil() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-transparent.png" alt="" className="h-9 w-9" />
            <span className="text-lg font-bold tracking-tight text-brand-600">Loc and Go</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#fonctions" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline">
              Fonctionnalités
            </a>
            <Link href="/connexion" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Mon espace
            </Link>
            <a href="#demo" className="rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-600">
              Demander une démo
            </a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-600 ring-1 ring-accent-100">
              Access anywhere
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Le suivi de votre parc de location, <span className="text-brand-600">par QR code</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Loc and Go relie chaque matériel à son contrat : préparation à l&apos;atelier, réception signée sur le chantier, SAV et retours demandés par
              vos clients d&apos;un simple scan. Sans application à installer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#demo" className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-3 font-semibold text-white shadow-sm hover:bg-accent-600">
                Demander une démo <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/connexion" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                Accéder à mon espace
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">Bâtiments modulaires, nacelles, engins, groupes électrogènes, échafaudages : Loc and Go s&apos;adapte à votre métier.</p>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-brand-100/60 blur-2xl" aria-hidden />
            <div className="relative rounded-[2rem] bg-slate-900 p-3 shadow-2xl">
              <div className="overflow-hidden rounded-[1.5rem] bg-slate-100">
                <div className="bg-brand-600 px-5 pb-6 pt-5 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100">Votre loueur</p>
                  <p className="mt-1 text-lg font-bold">Nacelle NAC-016</p>
                  <p className="text-xs text-brand-100">Contrat LOC-2026-142 · Chantier de Villeurbanne</p>
                </div>
                <div className="-mt-3 space-y-2 px-4 pb-5">
                  {[
                    { icon: PenLine, t: "Signer la réception", s: "3 matériels livrés" },
                    { icon: LifeBuoy, t: "Signaler un problème", s: "SAV avec photos" },
                    { icon: ScanLine, t: "Demander le retour", s: "Un ou plusieurs matériels" },
                  ].map(({ icon: Icon, t, s }) => (
                    <div key={t} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{t}</span>
                        <span className="block text-xs text-slate-500">{s}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            { icon: Smartphone, t: "Aucune application", s: "Un navigateur suffit, au bureau, à l'atelier et chez le client." },
            { icon: ShieldCheck, t: "Tout est tracé", s: "Photos, signatures et dates pour chaque départ et chaque retour." },
            { icon: Sparkles, t: "Contrats lus par l'IA", s: "Déposez un contrat : client, dates et matériel sont pré-remplis." },
          ].map(({ icon: Icon, t, s }) => (
            <div key={t} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 flex-none text-accent-500" />
              <div>
                <p className="font-semibold text-slate-900">{t}</p>
                <p className="text-sm text-slate-600">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="fonctions" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Tout le cycle de location, au même endroit</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          De la sortie du dépôt au retour au parc, chaque étape est enregistrée sur le matériel lui-même. Fini les appels pour savoir où en est un chantier.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FONCTIONS.map(({ icon: Icon, titre, texte }) => (
            <div key={titre} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Opérationnel en une journée</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {ETAPES.map((e) => (
              <div key={e.n}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-500 text-lg font-bold">{e.n}</span>
                <h3 className="mt-4 text-lg font-semibold">{e.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-100">{e.texte}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-center gap-3 rounded-2xl bg-white/10 p-5">
            <FileSpreadsheet className="h-6 w-6 flex-none text-accent-100" />
            <p className="text-sm text-brand-50">
              Vous gardez votre logiciel de gestion : Loc and Go s&apos;ajoute à côté, pour le terrain. Vos données s&apos;exportent à tout moment en Excel.
            </p>
          </div>
        </div>
      </section>

      <section id="demo" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Loc and Go" className="h-32 w-auto" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">Voyons ensemble votre parc</h2>
          <p className="mt-3 text-slate-600">
            En une démonstration de 30 minutes, nous vous montrons le parcours complet sur votre propre matériel : import du parc, plaques QR, préparation,
            livraison et retour.
          </p>
          <p className="mt-4 text-sm text-slate-500">Vous avez reçu un lien d&apos;accès ? Utilisez le bouton « Mon espace » en haut de la page.</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <DemoForm />
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} Loc and Go</span>
          <span className="flex gap-4">
            <Link href="/connexion" className="hover:text-slate-800">
              Mon espace
            </Link>
            <a href="#demo" className="hover:text-slate-800">
              Demander une démo
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
