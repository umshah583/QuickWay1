import { NextResponse } from "next/server";
import { format } from "date-fns";
import { loadTransactions } from "../transactionsData";

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const startDate = parseDateParam(startParam);
  const endDate = parseDateParam(endParam);

  const now = new Date();
  const timestamp = format(now, "yyyyMMdd_HHmmss");

  const { transactions } = await loadTransactions({ startDate, endDate });

  const header = [
    "Date",
    "Type",
    "Channel",
    "Amount (AED)",
    "Counterparty",
    "Status",
    "Description",
    "Customer",
    "Customer Email",
    "Driver",
    "Driver Email",
    "Recorded By",
    "Recorded By Email",
    "Booking Ref",
  ];

  const rows = transactions.map((tx) => [
    format(tx.occurredAt, "yyyy-MM-dd HH:mm:ss"),
    tx.type,
    tx.channel,
    (tx.amountCents / 100).toFixed(2),
    tx.counterparty,
    tx.status ?? "",
    tx.description,
    tx.customerName ?? "",
    tx.customerEmail ?? "",
    tx.driverName ?? "",
    tx.driverEmail ?? "",
    tx.recordedByName ?? "",
    tx.recordedByEmail ?? "",
    tx.bookingRef ?? "",
  ]);

  const csvLines = [header, ...rows]
    .map((line) => line.map(toCsvValue).join(","))
    .join("\n");

  const response = new NextResponse(csvLines, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions_${timestamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });

  return response;
}
