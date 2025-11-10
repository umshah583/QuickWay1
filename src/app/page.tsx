import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[var(--gradient-from)] via-[var(--gradient-via)] to-[var(--gradient-to)] text-[var(--text-strong)]">
      <section className="relative overflow-hidden border-b border-[var(--surface-border)]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[var(--hero-radial)]" />
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-16 sm:pt-32 sm:pb-24">
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight text-[var(--text-strong)]">
            Shine greener. Drive cleaner.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-muted)]">
            Premium washing, detailing, and polishing with eco-conscious products and meticulous care. Schedule in minutes and enjoy a radiant finish.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/booking"
              className="hero-book-btn"
            >
              Book now
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-full px-9 py-3 font-semibold border border-[var(--outline-button-border)] text-[var(--outline-button-text)] hover:border-[var(--outline-button-hover)] hover:text-[var(--outline-button-hover)] transition"
            >
              Explore services
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 grid gap-6 sm:grid-cols-3">
        {[
          {
            icon: "✨",
            title: "Showroom Finish",
            desc: "Multi-stage polish that revives paintwork and seals in the shine.",
          },
          {
            icon: "🌿",
            title: "Eco Care",
            desc: "Biodegradable products, low-water process, premium results.",
          },
          {
            icon: "⏱️",
            title: "On Your Time",
            desc: "Reserve in minutes and track your booking from your dashboard.",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm hover:border-[var(--card-hover-border)] hover:shadow-lg transition"
          >
            <div className="text-3xl">{feature.icon}</div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--text-strong)]">{feature.title}</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{feature.desc}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--cta-bg)] p-10 sm:p-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 text-[var(--text-strong)]">
          <div>
            <h2 className="text-3xl font-semibold">Ready for a spotless ride?</h2>
            <p className="mt-3 text-[var(--text-muted)]">
              Reserve your slot today and let our specialists restore the brilliance to your vehicle.
            </p>
          </div>
          <Link
            href="/booking"
            className="inline-flex items-center justify-center rounded-full px-8 py-3 font-semibold text-[var(--cta-button-text)] bg-[var(--cta-button-bg)] shadow-[0_16px_30px_rgba(22,163,74,0.25)] hover:brightness-110 transition"
          >
            Book your wash
          </Link>
        </div>
      </section>
    </main>
  );
}
