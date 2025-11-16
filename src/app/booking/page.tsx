import prisma from "@/lib/prisma";
import BookingForm from "./BookingForm";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function BookingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/sign-in?callbackUrl=${encodeURIComponent("/booking")}`);

  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { priceCents: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      priceCents: true,
      discountPercentage: true,
    },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Create a Booking</h1>
      <BookingForm services={services} />
    </div>
  );
}
