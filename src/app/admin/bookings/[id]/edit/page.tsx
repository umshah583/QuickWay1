import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingEditForm from "@/app/admin/bookings/BookingEditForm";
import { updateBooking } from "@/app/admin/bookings/actions";

type EditBookingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBookingPage({ params }: EditBookingPageProps) {
  const { id } = await params;

  const [booking, services, drivers] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      include: {
        Service: true,
        Payment: true,
      },
    }),
    prisma.service.findMany({
      select: {
        id: true,
        name: true,
        durationMin: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "DRIVER" },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    }).then(drivers => drivers.map(driver => ({
      ...driver,
      name: driver.name || driver.email || "Unknown Driver"
    }))),
  ]);

  if (!booking) {
    notFound();
  }

  // Format startAt for datetime-local input
  const formatForDateTimeLocal = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
          Edit Booking
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Modify booking details and assign drivers
        </p>
      </header>

      <BookingEditForm
        action={updateBooking}
        bookingId={booking.id}
        services={services}
        drivers={drivers}
        initialServiceId={booking.serviceId}
        initialStartAt={formatForDateTimeLocal(booking.startAt)}
        initialStatus={booking.status}
        initialDriverId={booking.driverId}
        initialCashCollected={booking.cashCollected || false}
        initialCashAmount={booking.cashAmountCents ? booking.cashAmountCents / 100 : 0}
        initialNotes={booking.driverNotes || ""}
      />
    </div>
  );
}
