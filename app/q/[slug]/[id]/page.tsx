import { ClientRoute } from "@/components/ClientRoute";

export default function Page({ params }: { params: { slug: string; id: string } }) {
  return <ClientRoute slug={params.slug} moduleId={params.id} />;
}
