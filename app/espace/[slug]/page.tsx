import { Connexion } from "@/components/Connexion";

export const metadata = { title: "Mon espace · Loc and Go" };

export default function Page({ params }: { params: { slug: string } }) {
  return <Connexion slugInitial={params.slug.toLowerCase()} />;
}
