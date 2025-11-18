import Link from "next/link";
import { Sparkles, Leaf, Clock, Shield, Star, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--text-strong)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[var(--surface-border)]">
        {/* Gradient Background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[var(--hero-gradient)]" />
          <div className="absolute top-0 right-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/2 rounded-full bg-[var(--brand-primary)] opacity-10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-secondary)] opacity-10 blur-3xl" />
        </div>
        
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 sm:pt-32 sm:pb-32">
          <div className="text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface)]/50 px-4 py-2 text-sm font-medium text-[var(--text-muted)] shadow-sm backdrop-blur-sm">
              <Star className="h-4 w-4 fill-[var(--warning)] text-[var(--warning)]" />
              <span>Trusted by 1000+ satisfied customers</span>
            </div>
            
            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight text-[var(--text-strong)]">
              Premium Car Care
              <br />
              <span className="bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-secondary)] to-[var(--brand-primary)] bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>
            
            {/* Subtitle */}
            <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--text-muted)]">
              Experience professional washing, detailing, and polishing with eco-friendly products. 
              Book online in seconds and enjoy a showroom finish.
            </p>
            
            {/* CTA Buttons */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/booking"
                className="hero-book-btn"
              >
                <Clock className="mr-2 h-5 w-5" />
                Book Now
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center justify-center rounded-full border-2 border-[var(--surface-border)] bg-[var(--surface)] px-8 py-4 font-semibold text-[var(--text-strong)] shadow-sm transition-all hover:border-[var(--brand-primary)] hover:shadow-md hover:scale-105"
              >
                View Services
              </Link>
            </div>
            
            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 border-t border-[var(--surface-border)] pt-12">
              <div>
                <div className="text-3xl font-bold text-[var(--brand-primary)]">1000+</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">Happy Customers</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[var(--brand-secondary)]">5000+</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">Cars Washed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[var(--success)]">4.9★</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">Avg Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-strong)]">Why Choose QuickWay?</h2>
          <p className="mt-4 text-lg text-[var(--text-muted)]">Professional service that delivers exceptional results</p>
        </div>
        
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Showroom Finish",
              desc: "Multi-stage polish and detailing that revives your car's paintwork and delivers a brilliant, long-lasting shine.",
              color: "from-[var(--brand-primary)] to-[var(--info)]",
            },
            {
              icon: Leaf,
              title: "Eco-Friendly",
              desc: "Biodegradable products and water-efficient processes that care for your car and the environment.",
              color: "from-[var(--success)] to-[var(--brand-secondary)]",
            },
            {
              icon: Clock,
              title: "Quick & Easy",
              desc: "Book online in seconds, choose your time slot, and track your service in real-time from your dashboard.",
              color: "from-[var(--warning)] to-[var(--danger)]",
            },
            {
              icon: Shield,
              title: "Trusted Service",
              desc: "Experienced professionals who treat your vehicle with care and attention to every detail.",
              color: "from-[var(--info)] to-[var(--brand-primary)]",
            },
            {
              icon: TrendingUp,
              title: "Best Value",
              desc: "Competitive pricing with transparent costs and flexible packages to suit your needs.",
              color: "from-[var(--brand-secondary)] to-[var(--success)]",
            },
            {
              icon: Star,
              title: "Top Rated",
              desc: "4.9-star average rating from thousands of satisfied customers who trust our service.",
              color: "from-[var(--warning)] to-[var(--brand-primary)]",
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[var(--brand-primary)]"
              >
                {/* Icon with gradient background */}
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} p-3 shadow-lg transition-transform group-hover:scale-110`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>
                
                <h3 className="mt-6 text-xl font-bold text-[var(--text-strong)]">{feature.title}</h3>
                <p className="mt-3 text-[var(--text-muted)] leading-relaxed">{feature.desc}</p>
                
                {/* Hover gradient effect */}
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--brand-primary)] opacity-0 blur-2xl transition-opacity group-hover:opacity-10" />
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-secondary)] to-[var(--info)] p-12 sm:p-16 text-white shadow-2xl">
          {/* Background Pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white blur-3xl" />
            <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-white blur-3xl" />
          </div>
          
          <div className="relative flex flex-col items-center text-center">
            <Sparkles className="h-16 w-16 mb-6" />
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Ready for a Spotless Ride?</h2>
            <p className="mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-white/90">
              Join thousands of satisfied customers. Book your professional car wash today and experience the QuickWay difference.
            </p>
            
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/booking"
                className="inline-flex items-center justify-center rounded-full bg-white px-10 py-4 text-lg font-bold text-[var(--brand-primary)] shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
              >
                <Clock className="mr-2 h-5 w-5" />
                Book Your Wash
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center justify-center rounded-full border-2 border-white/30 bg-white/10 px-10 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/50"
              >
                View All Services
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
