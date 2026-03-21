import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DriverEditClient from "./DriverEditClient";

type EditDriverPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDriverPage({ params }: EditDriverPageProps) {
  const { id } = await params;

  const driver = await prisma.user.findUnique({
    where: { id, role: "DRIVER" },
  });

  if (!driver) {
    notFound();
  }

  return <DriverEditClient driver={driver} />;
}
