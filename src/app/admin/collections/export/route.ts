import { NextResponse } from "next/server";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    driver: true;
    service: true;
    user: true;
    payment: true;
  };
}>;

function deriveIdentifiers(booking: BookingWithRelations) {
  const reference = booking.payment?.id?.trim() || booking.id;
  const shortId = reference.slice(-6).toUpperCase();
  const datePart = format(booking.startAt, "yyyyMMdd");
  const orderId = `ORD-${datePart}-${shortId}`;
  const invoiceNumber = `INV-${datePart}-${shortId}`;
  return { orderId, invoiceNumber };
}

export async function GET() {
  const bookings = await prisma.booking.findMany({
    where: { cashCollected: true },
    orderBy: { startAt: "desc" },
    include: {
      driver: true,
      service: true,
      user: true,
      payment: true,
    },
  });

  const sheetData = bookings.map((booking: BookingWithRelations) => {
    const collectedAmount = booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
    const { orderId, invoiceNumber } = deriveIdentifiers(booking);

    return {
      Date: format(booking.startAt, "yyyy-MM-dd"),
      "Order ID": orderId,
      "Invoice #": invoiceNumber,
      Service: booking.service?.name ?? "Service",
      "Customer Name": booking.user?.name ?? booking.user?.email ?? "Customer",
      "Customer Email": booking.user?.email ?? "—",
      "Driver Name": booking.driver?.name ?? booking.driver?.email ?? "Unassigned",
      "Driver Email": booking.driver?.email ?? "—",
      Collected: collectedAmount / 100,
      Currency: "USD",
      Notes: booking.driverNotes ?? "",
    };
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(sheetData.length ? sheetData : [{ Message: "No collections recorded" }]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Collections");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  const timestamp = format(new Date(), "yyyyMMdd-HHmmss");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="collections-${timestamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
