import { ClientRoute } from "@/components/ClientRoute";

// Anciennes plaques (avant les espaces) : elles appartiennent à l'espace principal.
export default function Page({ params }: { params: { id: string } }) {
  return <ClientRoute slug="principal" moduleId={params.id} />;
}
