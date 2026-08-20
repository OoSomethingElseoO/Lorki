import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConservancyForm } from "@/components/admin/conservancy-form";

type EditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditConservancyPage({ params }: EditPageProps) {
  const { id } = await params;
  const conservancy = await prisma.conservancy.findUnique({ where: { id } });

  if (!conservancy) {
    notFound();
  }

  return (
    <>
      <h1>Edit {conservancy.name}</h1>
      <ConservancyForm id={conservancy.id} initial={conservancy} />
    </>
  );
}
