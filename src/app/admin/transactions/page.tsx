import Link from "next/link";
import { format } from "date-fns";
import { loadTransactions, DEFAULT_TRANSACTION_LIMIT, type TransactionRecord } from "./transactionsData";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function getSingleParam(value?: string | string[]): string | undefined {
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function parseDateParam(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
}

type TransactionsSearchParams = {
  page?: string;
  start?: string | string[];
  end?: string | string[];
};

type TransactionsPageProps = {
  searchParams: Promise<TransactionsSearchParams>;
};

export default async function AdminTransactionsPage({ searchParams }: TransactionsPageProps) {
  const params = await searchParams;
  const pageParam = Number.parseInt(params?.page ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const startParamRaw = getSingleParam(params?.start);
  const endParamRaw = getSingleParam(params?.end);
  const startDate = parseDateParam(startParamRaw);
  const endDate = parseDateParam(endParamRaw);

  const { transactions, totalCredits, totalDebits, net } = await loadTransactions({
    limit: DEFAULT_TRANSACTION_LIMIT,
    startDate,
    endDate,
  });

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const pageIndex = Math.min(page, totalPages) - 1;
  const pagedTransactions: TransactionRecord[] = transactions.slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE,
  );

  const baseQuery = new URLSearchParams();
  if (startParamRaw) {
    baseQuery.set("start", startParamRaw);
  }
  if (endParamRaw) {
    baseQuery.set("end", endParamRaw);
  }
  const preservedQuery = baseQuery.toString();
  const exportHref = preservedQuery ? `/admin/transactions/export?${preservedQuery}` : "/admin/transactions/export";
  const startInputValue = startParamRaw ?? "";
  const endInputValue = endParamRaw ?? "";

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Financial ledger</p>
        <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Transactions</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Monitor card and cash credits alongside partner payout debits. Data limited to the {DEFAULT_TRANSACTION_LIMIT} most recent entries per channel.
        </p>
      </header>

      <form method="get" className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-strong)]">Start date</span>
            <input
              type="date"
              name="start"
              defaultValue={startInputValue}
              className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-strong)]">End date</span>
            <input
              type="date"
              name="end"
              defaultValue={endInputValue}
              className="mt-1 h-10 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
            >
              Apply
            </button>
            <Link
              href="/admin/transactions"
              className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Credits</h2>
          <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalCredits)}</p>
          <p className="text-xs text-[var(--text-muted)]">Card + cash receipts</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Debits</h2>
          <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalDebits)}</p>
          <p className="text-xs text-[var(--text-muted)]">Partner payouts</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Net</h2>
          <p className={`mt-3 text-2xl font-semibold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(net)}</p>
          <p className="text-xs text-[var(--text-muted)]">Credits minus debits</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Entries loaded</h2>
          <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{transactions.length}</p>
          <p className="text-xs text-[var(--text-muted)]">
            Showing page {pageIndex + 1} of {totalPages}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Transaction detail</h2>
            <p className="text-sm text-[var(--text-muted)]">Latest financial movements across QuickWay and partner accounts.</p>
          </div>
          <div className="flex flex-col gap-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:gap-2">
            <Link
              href={exportHref}
              className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1 font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              Download CSV
            </Link>
            <div className="flex items-center gap-2">
              <PaginationLink page={pageIndex} totalPages={totalPages} direction="prev" query={preservedQuery} />
              <span>
                Page {pageIndex + 1} of {totalPages}
              </span>
              <PaginationLink page={pageIndex} totalPages={totalPages} direction="next" query={preservedQuery} />
            </div>
          </div>
        </header>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Channel</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Counterparty</th>
                <th className="px-2 py-2">Recorded by</th>
                <th className="px-2 py-2">Details</th>
                <th className="px-2 py-2 whitespace-nowrap">Gross</th>
                <th className="px-2 py-2 whitespace-nowrap">Stripe %</th>
                <th className="px-2 py-2 whitespace-nowrap">Stripe 1 AED</th>
                <th className="px-2 py-2 whitespace-nowrap">VAT</th>
                <th className="px-2 py-2 whitespace-nowrap">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {pagedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-2 py-4 text-center text-xs text-[var(--text-muted)]">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                pagedTransactions.map((tx) => (
                  <tr key={`${tx.type}-${tx.id}-${tx.occurredAt.getTime()}`} className="bg-white/5 align-top">
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">{format(tx.occurredAt, "d MMM yyyy, h:mma")}</td>
                    <td className={`px-2 py-2 font-semibold whitespace-nowrap ${tx.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.type === "credit" ? "Credit" : "Debit"}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">{tx.channel}</td>
                    <td className="px-2 py-2 font-semibold text-[var(--text-strong)] whitespace-nowrap">{formatCurrency(tx.amountCents)}</td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      {tx.customerName ? (
                        <span className="flex flex-col text-xs leading-5">
                          <span className="font-semibold text-[var(--text-strong)]">{tx.customerName}</span>
                          {tx.customerEmail ? <span>{tx.customerEmail}</span> : null}
                        </span>
                      ) : (
                        <span className="text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      <span className="flex flex-col text-xs leading-5">
                        <span className="font-semibold text-[var(--text-strong)]">{tx.counterparty}</span>
                        {tx.status ? <span className="uppercase tracking-[0.2em] text-[10px]">{tx.status}</span> : null}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      {tx.recordedByName ? (
                        <span className="flex flex-col text-xs leading-5">
                          <span className="font-semibold text-[var(--text-strong)]">{tx.recordedByName}</span>
                          {tx.recordedByEmail ? <span>{tx.recordedByEmail}</span> : null}
                        </span>
                      ) : tx.driverName ? (
                        <span className="flex flex-col text-xs leading-5">
                          <span className="font-semibold text-[var(--text-strong)]">Driver: {tx.driverName}</span>
                          {tx.driverEmail ? <span>{tx.driverEmail}</span> : null}
                        </span>
                      ) : (
                        <span className="text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">
                      <span className="flex flex-col gap-1 text-xs leading-5">
                        <span>{tx.description}</span>
                        {tx.bookingRef ? (
                          <span className="inline-flex gap-1 text-[var(--brand-primary)]">
                            Booking
                            <Link
                              href={`/admin/bookings/${tx.bookingRef}`}
                              className="font-semibold underline decoration-dotted"
                            >
                              #{tx.bookingRef.slice(-6)}
                            </Link>
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {typeof tx.grossAmountCents === "number" ? formatCurrency(tx.grossAmountCents) : <span className="text-[11px]">—</span>}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {typeof tx.stripePercentFeeCents === "number" && tx.stripePercentFeeCents !== 0 ? (
                        <span>-{formatCurrency(tx.stripePercentFeeCents)}</span>
                      ) : (
                        <span className="text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {typeof tx.stripeFixedFeeCents === "number" && tx.stripeFixedFeeCents !== 0 ? (
                        <span>-{formatCurrency(tx.stripeFixedFeeCents)}</span>
                      ) : (
                        <span className="text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {typeof tx.vatCents === "number" && tx.vatCents !== 0 ? (
                        <span>-{formatCurrency(tx.vatCents)}</span>
                      ) : (
                        <span className="text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-strong)] whitespace-nowrap">
                      {typeof tx.netAmountCents === "number" ? (
                        <span>{formatCurrency(tx.netAmountCents)}</span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PaginationLink({
  page,
  totalPages,
  direction,
  query,
}: {
  page: number;
  totalPages: number;
  direction: "prev" | "next";
  query?: string;
}) {
  const targetPage = direction === "prev" ? page : page + 2;
  const isDisabled = direction === "prev" ? page <= 0 : page + 1 >= totalPages;

  if (isDisabled) {
    return (
      <span className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] text-[var(--text-muted)] opacity-50">
        {direction === "prev" ? "Prev" : "Next"}
      </span>
    );
  }

  const params = new URLSearchParams(query ?? "");
  params.set("page", String(targetPage));
  const search = params.toString();
  const href = `/admin/transactions${search ? `?${search}` : ""}`;

  return (
    <Link
      href={href}
      className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
    >
      {direction === "prev" ? "Prev" : "Next"}
    </Link>
  );
}
