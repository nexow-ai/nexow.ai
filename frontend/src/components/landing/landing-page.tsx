import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { ArrowRight, Bot, Copy, Shield, Trophy, Zap, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: Bot,
    title: "No-Code Agent Factory",
    description: "Describe your strategy in plain English. Our AI converts it into a precise, executable trading agent.",
    gradient: "from-emerald-500/20 to-emerald-500/0",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Trophy,
    title: "Wall of Fame",
    description: "Real-time leaderboard ranking agents by ROI, Win Rate, and Drawdown. Skill over luck.",
    gradient: "from-amber-500/20 to-amber-500/0",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Copy,
    title: "Blind Social Trading",
    description: "Copy top agents automatically. The strategy stays hidden. Copiers see results, creators own the IP.",
    gradient: "from-cyan-500/20 to-cyan-500/0",
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    icon: Zap,
    title: "Dual-Brain Engine",
    description: "Systematic agents for speed. Discretionary agents with LLM reasoning, news analysis, and web search.",
    gradient: "from-purple-500/20 to-purple-500/0",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: Shield,
    title: "Built-in Guardrails",
    description: "Drawdown limits, trailing stops, daily loss caps. The kill switch protects your capital automatically.",
    gradient: "from-red-500/20 to-red-500/0",
    iconColor: "text-red-400",
    iconBg: "bg-red-500/10 border-red-500/20",
  },
  {
    icon: TrendingUp,
    title: "Multi-Asset Portfolios",
    description: "Trade multiple instruments with correlation-aware allocation. Auto-rebalancing and hedging built in.",
    gradient: "from-blue-500/20 to-blue-500/0",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
  },
];

const stats = [
  { label: "Instruments", value: "8+" },
  { label: "Strategies", value: "6" },
  { label: "Tick Speed", value: "5s" },
  { label: "Uptime", value: "24/7" },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Mesh gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute right-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-purple-500/5 blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-16">
        <Logo size="lg" />
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-6 pb-24 pt-16 text-center lg:pt-28">
        <div className="animate-fade-in mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-5 py-2 text-sm font-medium text-emerald-400 backdrop-blur-sm">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          The Decentralized Hedge Fund
        </div>

        <h1 className="animate-fade-in text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
          Build Trading Agents
          <br />
          <span className="text-gradient">With Just Words</span>
        </h1>

        <p className="animate-fade-in mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400" style={{ animationDelay: "100ms" }}>
          Create 24/7 algorithmic trading agents using natural language. Compete
          on a global leaderboard. Let others copy your trades — while your
          strategy stays secret.
        </p>

        <div className="animate-fade-in mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "200ms" }}>
          <Link href="/signup">
            <Button size="lg" className="min-w-[180px]">
              Start Building
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" size="lg" className="min-w-[180px]">
              View Leaderboard
            </Button>
          </Link>
        </div>

        {/* Stats strip */}
        <div className="animate-fade-in mt-20 grid grid-cols-2 gap-4 sm:grid-cols-4" style={{ animationDelay: "300ms" }}>
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-zinc-800/40 bg-zinc-900/30 px-6 py-4 backdrop-blur-sm">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-6xl px-6 pb-32">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything You Need to Trade Smarter
          </h2>
          <p className="mt-4 text-zinc-500">
            A complete ecosystem for algorithmic trading, powered by AI.
          </p>
        </div>

        <div className="stagger-children grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800/40 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/50 hover:bg-zinc-900/50"
            >
              {/* Gradient glow on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

              <div className="relative">
                <div className={`mb-4 inline-flex rounded-xl border p-3 ${feature.iconBg}`}>
                  <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-t border-zinc-800/40">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-500/[0.02]" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Build Your First Agent?
          </h2>
          <p className="mt-4 text-lg text-zinc-500">
            Join Nexow and start competing on the Wall of Fame today.
          </p>
          <div className="mt-10">
            <Link href="/signup">
              <Button size="lg" className="min-w-[220px]">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/30 px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo size="sm" />
          <p className="text-xs text-zinc-700">
            &copy; {new Date().getFullYear()} Nexow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
