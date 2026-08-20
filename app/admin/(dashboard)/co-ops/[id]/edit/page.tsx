import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CoOpForm } from "@/components/admin/co-op-form";

type EditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCoOpPage({ params }: EditPageProps) {
  const { id } = await params;
  const coOp = await prisma.coOp.findUnique({ where: { id } });

  if (!coOp) {
    notFound();
  }

  return (
    <>
      <h1>Edit {coOp.name}</h1>
      <CoOpForm id={coOp.id} initial={coOp} />
    </>
  );
}
