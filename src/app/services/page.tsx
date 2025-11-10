import prisma from "@/lib/prisma";
import Link from "next/link";
type ServiceType = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  active: boolean;
};

export default async function ServicesPage() {
  const services: ServiceType[] = await prisma.service.findMany({
    where: { active: true },
    orderBy: { priceCents: "asc" },
    select: { id: true, name: true, description: true, durationMin: true, priceCents: true, active: true },
  });
  const formatter = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold mb-6">Services & Pricing</h1>
      <div className="grid sm:grid-cols-2 gap-6">
        {services.map((s: ServiceType) => (
          <div key={s.id} className="border rounded p-4">
            <h2 className="text-xl font-medium">{s.name}</h2>
            {s.description && <p className="text-sm text-zinc-600 mt-1">{s.description}</p>}
            <p className="mt-2 text-zinc-800">Duration: {s.durationMin} min</p>
            <p className="mt-1 font-semibold">{formatter.format(s.priceCents / 100)}</p>
            <Link href={`/booking?service=${s.id}`} className="inline-block mt-3 rounded border px-3 py-1">Book</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
