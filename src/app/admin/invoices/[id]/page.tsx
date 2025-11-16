import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "../PrintButton";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "AED" }).format(cents / 100);
}

type AdminInvoicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminInvoicePage({ params }: AdminInvoicePageProps) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
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
  const cardPaid = booking.payment?.status === "PAID";
  const cardAmount = cardPaid ? booking.payment?.amountCents ?? servicePrice : 0;
  const cashCollectedAmount = booking.cashCollected ? booking.cashAmountCents ?? servicePrice : 0;
  const totalCollected = cardAmount > 0 ? cardAmount : cashCollectedAmount;
  const pending = Math.max(servicePrice - totalCollected, 0);
  const paymentMethod = cardPaid ? "Card" : booking.cashCollected ? "Cash" : "Unpaid";
  const summaryLabel = pending > 0 ? "Balance due" : "Paid in full";
  const summaryAmount = pending > 0 ? pending : servicePrice;
  const orderReference = booking.payment?.id ?? id;
  const orderId = orderReference.toUpperCase();
  const invoiceNumber = `INV-${format(booking.startAt, "yyyyMMdd")}-${orderReference.slice(-6).toUpperCase()}`;
  const generatedOn = format(booking.updatedAt ?? booking.startAt, "MMMM d, yyyy h:mm a");

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white p-8 text-gray-900">
      <header className="flex flex-col items-center gap-3 border-b border-gray-200 pb-6 text-center">
        <h1 className="text-2xl font-semibold uppercase tracking-[0.3em] text-gray-900">Tax Invoice</h1>
        <div className="text-sm text-gray-500 space-y-1">
          <p>
            Invoice #: <span className="font-semibold text-gray-900">{invoiceNumber}</span>
          </p>
          <p>
            Order ID: <span className="font-semibold text-gray-900">{orderId}</span>
          </p>
          <p>Date: {format(booking.startAt, "MMMM d, yyyy")}</p>
          <p suppressHydrationWarning>Generated: {generatedOn}</p>
        </div>
        <PrintButton className="print:hidden" />
      </header>

      <section className="grid gap-6 text-sm sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Company</h2>
          <p className="font-medium text-gray-900">Quickway Car Care</p>
          <p className="text-gray-500">123 Service Avenue, Dubai, UAE</p>
          <p className="text-gray-500">Phone: +971 55 123 4567</p>
          <p className="text-gray-500">Email: support@quickway.ae</p>
        </div>
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Billed to</h2>
          <p className="font-medium text-gray-900">{booking.user?.name || booking.user?.email || "Customer"}</p>
          <p className="text-gray-500">{booking.user?.email ?? "No email on file"}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium text-right">VAT (5%)</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-4 py-3 text-gray-500">{format(booking.startAt, "MMM d, yyyy • h:mm a")}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{booking.service?.name ?? "Service"}</td>
              <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(Math.round(servicePrice * 0.05))}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(servicePrice)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-4 border-t border-gray-200 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 text-sm text-gray-500">
          <p>
            Payment method: <span className="font-semibold text-gray-900">{paymentMethod}</span>
          </p>
          <p>
            Paid amount: <span className="font-semibold text-gray-900">{formatCurrency(totalCollected)}</span>
          </p>
          {pending > 0 ? (
            <p>
              Pending collection: <span className="font-semibold text-gray-900">{formatCurrency(pending)}</span>
            </p>
          ) : (
            <p className="text-emerald-600">Balance cleared — no pending amount.</p>
          )}
        </div>
        <div className="text-right text-sm text-gray-500">
          <p className="text-xs uppercase tracking-[0.2em]">{summaryLabel}</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summaryAmount)}</p>
        </div>
      </section>

      <footer className="flex justify-between border-t border-gray-200 pt-6 text-xs text-gray-400">
        <p>Thank you for choosing Quickway.</p>
        <Link href="/admin/collections" className="text-[var(--brand-primary)] hover:underline">
          Back to collections
        </Link>
      </footer>
    </div>
  );
}
