import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CustomerEditClient from "./CustomerEditClient";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;

  const customer = await prisma.user.findUnique({
    where: { id, role: "USER" },
  });

  if (!customer) {
    notFound();
  }

  return <CustomerEditClient customer={customer} />;
}
