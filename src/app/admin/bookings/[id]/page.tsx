import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import BookingEditForm from "../BookingEditForm";
import { updateBooking } from "../actions";
import { format } from "date-fns";

type ServiceListItem = Awaited<ReturnType<typeof prisma.service.findMany>>[number];
type DriverListItem = Awaited<ReturnType<typeof prisma.user.findMany>>[number];
type BookingFormStatus = "PENDING" | "PAID" | "CANCELLED";

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    service: true;
    user: true;
    driver: true;
    payment: true;
  };
}>;

function toFormStatus(status: string): BookingFormStatus {
  return status === "PAID" || status === "CANCELLED" ? status : "PENDING";
}

export const dynamic = "force-dynamic";

type BookingEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BookingEditPage({ params }: BookingEditPageProps) {
  const { id } = await params;

  const booking = (await prisma.booking.findUnique({
    where: { id },
    include: {
      service: true,
      user: true,
      driver: true,
      payment: true,
    },
  })) as BookingWithRelations | null;

  if (!booking) {
    notFound();
  }

  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const drivers = await prisma.user.findMany({
    where: { role: UserRole.DRIVER },
    orderBy: { name: "asc" },
  });

  const initialStartAt = booking.startAt.toISOString().slice(0, 16);
  const initialStatus = toFormStatus(booking.status);

  const paymentStatus = booking.payment?.status ?? "REQUIRES_PAYMENT";
  const paymentRef = booking.payment?.id ?? "—";
  const customerName = booking.user?.name || booking.user?.email || "Customer";
  const locationLabel = booking.locationLabel || "Not provided";
  const locationLink = booking.locationCoordinates || null;
  const vehicleDetails = [booking.vehicleMake, booking.vehicleModel, booking.vehicleColor].filter(Boolean).join(" · ");
  const plate = booking.vehiclePlate || "—";
  const cashAmountAED = booking.cashAmountCents ? (booking.cashAmountCents / 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Order details</p>
        <h1 className="text-3xl font-semibold text-[var(--text-strong)]">{customerName}</h1>
        <p className="text-sm text-[var(--text-muted)]">Service scheduled for {format(booking.startAt, "EEEE, MMMM d • h:mm a")}</p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 text-sm sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Customer</h2>
          <p className="font-medium text-[var(--text-strong)]">{customerName}</p>
          <p className="text-[var(--text-muted)]">{booking.user?.email ?? "Email not provided"}</p>
          <p className="text-[var(--text-muted)]">{booking.user?.phoneNumber ?? "Phone not provided"}</p>
        </div>
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Location</h2>
          <p className="font-medium text-[var(--text-strong)]">{locationLabel}</p>
          {locationLink ? (
            <a href={locationLink} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-primary)] underline">
              Open in Google Maps
            </a>
          ) : (
            <p className="text-[var(--text-muted)]">No map link submitted.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 text-sm sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Vehicle</h2>
          <p className="font-medium text-[var(--text-strong)]">{vehicleDetails || "Vehicle details not provided"}</p>
          <p className="text-[var(--text-muted)]">Plate: {plate}</p>
        </div>
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Payment</h2>
          <p>Status: <span className="font-semibold text-[var(--text-strong)]">{paymentStatus}</span></p>
          <p>Reference: {paymentRef}</p>
          <p>Cash collected: {booking.cashCollected ? `Yes (AED ${cashAmountAED})` : "No"}</p>
          <p>Driver notes: {booking.driverNotes ?? "—"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <h2 className="text-sm font-semibold text-[var(--text-strong)]">Manage booking</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Update service, timing, driver assignment, or status.</p>
        <div className="mt-5">
          <BookingEditForm
            action={updateBooking}
            bookingId={booking.id}
            services={services.map((service: ServiceListItem) => ({
              id: service.id,
              name: service.name,
              durationMin: service.durationMin,
            }))}
            drivers={drivers.map((driver: DriverListItem) => ({
              id: driver.id,
              name: driver.name ?? "",
              email: driver.email,
            }))}
            initialServiceId={booking.serviceId}
            initialStartAt={initialStartAt}
            initialStatus={initialStatus}
            initialDriverId={booking.driverId ?? null}
            initialCashCollected={booking.cashCollected}
            initialCashAmount={booking.cashAmountCents ?? 0}
            initialNotes={booking.driverNotes ?? null}
          />
        </div>
      </section>

      <footer className="flex justify-end">
        <Link
          href="/admin/bookings"
          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Back to bookings
        </Link>
      </footer>
    </div>
  );
}
