import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { ArrowRight, Bot, Copy, Shield, Trophy, Zap } from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: Bot,
    title: "No-Code Agent Factory",
    description:
      "Describe your strategy in plain English. Our AI converts it into a precise, executable trading agent. No coding required.",
    color: "text-emerald-400",
    bg: "bg-emerald-900/20",
  },
  {
    icon: Trophy,
    title: "Wall of Fame",
    description:
      "Real-time leaderboard ranking agents by ROI, Win Rate, and Drawdown. Separate the lucky from the truly skilled.",
    color: "text-amber-400",
    bg: "bg-amber-900/20",
  },
  {
    icon: Copy,
    title: "Blind Social Trading",
    description:
      "Copy top-performing agents automatically. The strategy stays hidden — copiers see results, creators own the IP.",
    color: "text-cyan-400",
    bg: "bg-cyan-900/20",
  },
  {
    icon: Zap,
    title: "Dual-Brain Engine",
    description:
      "Systematic agents run lightning-fast rules. Discretionary agents use LLMs to reason about news and context before trading.",
    color: "text-purple-400",
    bg: "bg-purple-900/20",
  },
  {
    icon: Shield,
    title: "Built-in Guardrails",
    description:
      "Hard limits on drawdown, position size, and daily losses. The kill switch activates automatically to protect capital.",
    color: "text-red-400",
    bg: "bg-red-900/20",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 lg:px-12">
        <Logo size="lg" />
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center lg:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-800/50 bg-emerald-900/20 px-4 py-1.5 text-sm text-emerald-400">
          <Zap className="h-4 w-4" />
          The Decentralized Hedge Fund
        </div>

        <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl">
          Build Trading Agents
          <br />
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            With Just Words
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          Create 24/7 algorithmic trading agents using natural language. Compete
          on a global leaderboard. Let others copy your trades — while your
          strategy stays secret.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg">
              Start Building
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" size="lg">
              View Leaderboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-zinc-100">
            Everything You Need to Trade Smarter
          </h2>
          <p className="mt-3 text-zinc-400">
            A complete ecosystem for algorithmic trading, powered by AI.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 transition-colors hover:border-zinc-700"
            >
              <div className={`mb-4 inline-flex rounded-lg ${feature.bg} p-3`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-100">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-zinc-100">
            Ready to Build Your First Agent?
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Join Nexow and start competing on the Wall of Fame today.
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button size="lg">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo size="sm" />
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Nexow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
