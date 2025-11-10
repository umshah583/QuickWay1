import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireDriverSession } from "@/lib/driver-auth";
import { PrintButton } from "@/app/admin/invoices/PrintButton";

export const dynamic = "force-dynamic";

type DriverInvoicePageProps = {
  params: Promise<{ id: string }>;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

export default async function DriverInvoicePage({ params }: DriverInvoicePageProps) {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const { id } = await params;

  const booking = await prisma.booking.findFirst({
    where: { id, driverId },
    include: {
      user: true,
      driver: true,
      service: true,
      payment: true,
    },
  });

  if (!booking) {
    notFound();
  }

  const servicePrice = booking.service?.priceCents ?? 0;
  const collected = booking.cashCollected ? booking.cashAmountCents ?? servicePrice : 0;
  const pending = Math.max(servicePrice - collected, 0);
  const orderReference = booking.payment?.id ?? booking.id;
  const orderId = orderReference.toUpperCase();
  const invoiceNumber = `INV-${format(booking.startAt, "yyyyMMdd")}-${orderReference.slice(-6).toUpperCase()}`;
  const generatedOn = format(booking.updatedAt ?? booking.startAt, "MMMM d, yyyy h:mm a");

  return (
    <div className="mx-auto max-w-xs font-mono text-[13px] text-gray-900 print:max-w-[58mm]">
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 shadow-sm print:border-0 print:rounded-none print:shadow-none">
        <header className="text-center">
          <h1 className="text-lg font-semibold uppercase tracking-[0.3em]">Tax Invoice</h1>
          <p className="mt-1 text-[11px] text-gray-500">Quickway Car Care</p>
          <p className="text-[11px] text-gray-500">123 Service Avenue, Dubai, UAE</p>
          <p className="text-[11px] text-gray-500">Phone: +971 55 123 4567</p>
          <p className="text-[11px] text-gray-500">support@quickway.ae</p>
          <div className="mt-3 space-y-1 text-left text-[12px]">
            <p>Invoice #: {invoiceNumber}</p>
            <p>Order ID: {orderId}</p>
            <p>Date: {format(booking.startAt, "dd/MM/yyyy HH:mm")}</p>
            <p suppressHydrationWarning>Printed: {generatedOn}</p>
            <p>Driver: {booking.driver?.name ?? "--"}</p>
          </div>
          <PrintButton className="mt-3 inline-flex items-center justify-center rounded-full border border-gray-300 px-3 py-1 text-[12px] font-semibold text-gray-700 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] print:hidden" />
        </header>

        <div className="mt-4 border-t border-dashed border-gray-300 pt-3 text-[12px]">
          <p className="font-semibold">Customer</p>
          <p>{booking.user?.name || booking.user?.email || "Customer"}</p>
          <p>{booking.user?.email ?? "Email not provided"}</p>
        </div>

        <div className="mt-4 border-t border-dashed border-gray-300 pt-3 text-[12px]">
          <p className="font-semibold">Service</p>
          <p>{booking.service?.name ?? "Service"}</p>
          <p>Duration: {booking.service?.durationMin ?? "--"} min</p>
          <p>Booked: {format(booking.startAt, "dd/MM/yyyy HH:mm")}</p>
        </div>

        <div className="mt-4 border-t border-dashed border-gray-300 pt-3 text-[12px]">
          <div className="flex justify-between">
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span>Service total</span>
            <span>{formatCurrency(servicePrice)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (5%)</span>
            <span>{formatCurrency(Math.round(servicePrice * 0.05))}</span>
          </div>
          <div className="flex justify-between">
            <span>Cash collected</span>
            <span>{formatCurrency(collected)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pending</span>
            <span>{formatCurrency(pending)}</span>
          </div>
          <div className="mt-3 flex justify-between border-t border-dashed border-gray-300 pt-2 text-[13px] font-semibold">
            <span>Total due</span>
            <span>{formatCurrency(servicePrice)}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-dashed border-gray-300 pt-3 text-center text-[11px] text-gray-500">
          <p>Thank you for trusting Quickway.</p>
          <p className="print:hidden">
            <Link href="/driver" className="text-[var(--brand-primary)] hover:underline">
              Back to driver dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
