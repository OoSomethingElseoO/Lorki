import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AnimalForm } from "@/components/admin/animal-form";

type EditAnimalPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditAnimalPage({ params }: EditAnimalPageProps) {
  const { id } = await params;

  const [animal, conservancies] = await Promise.all([
    prisma.animal.findUnique({ where: { id } }),
    prisma.conservancy.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!animal) {
    notFound();
  }

  return (
    <>
      <h1>Edit {animal.name}</h1>
      <AnimalForm
        id={animal.id}
        conservancies={conservancies}
        initial={{
          name: animal.name,
          species: animal.species,
          region: animal.region,
          story: animal.story,
          imageUrl: animal.imageUrl,
          conservancyId: animal.conservancyId,
        }}
      />
    </>
  );
}
