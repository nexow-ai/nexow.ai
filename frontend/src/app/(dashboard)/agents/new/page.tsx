"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { AGENT_TEMPLATES, type AgentTemplate } from "@/lib/agent-templates";
import { RuleDisplay } from "@/components/agents/rule-display";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Brain,
  Check,
  Loader2,
  Rocket,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type WizardStep = "prompt" | "preview" | "deploy";

const EXAMPLE_PROMPTS = [
  "Cautious Gold trader using RSI on H1 timeframe",
  "Aggressive EUR/USD scalper with MACD on M5",
  "Smart news-aware agent that trades XAU/USD based on market sentiment",
  "EUR/USD and GBP/USD portfolio with Bollinger Bands on M15",
  "Conservative discretionary agent analyzing EUR/USD with web search",
];

interface GeneratedAgent {
  agent_type: string;
  name: string;
  description: string;
  portfolio_summary: string;
  config: Record<string, unknown>;
}

export default function NewAgentPage() {
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>("prompt");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<GeneratedAgent | null>(null);

  function loadTemplate(template: AgentTemplate) {
    setPrompt(template.prompt);
    setGenerated({
      agent_type: template.agent_type,
      name: template.name,
      description: template.description,
      portfolio_summary: "",
      config: template.config,
    });
    setStep("preview");
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setError("");
    setGenerating(true);

    try {
      const res = await fetch("/api/generate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data: GeneratedAgent = await res.json();
      setGenerated(data);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeploy() {
    if (!generated) return;
    setError("");
    setDeploying(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const config = { ...generated.config };
      const portfolio = (config as Record<string, unknown>).portfolio as Record<string, unknown> | undefined;
      const instruments = (portfolio?.instruments ?? []) as Array<Record<string, unknown>>;
      const primaryInstrument = instruments[0]?.instrument as string ?? "EUR_USD";
      const primaryTimeframe = instruments[0]?.timeframe as string ?? "M5";

      const { data, error: insertError } = await (supabase.from as Function)("agents")
        .insert({
          creator_id: user.id,
          name: generated.name,
          description: generated.description,
          type: generated.agent_type,
          config,
          prompt: prompt.trim(),
          instrument: primaryInstrument,
          instruments: instruments,
          timeframe: primaryTimeframe,
          llm_provider: (config as Record<string, unknown>).llm_provider ?? "openai",
          llm_model: (config as Record<string, unknown>).llm_model ?? "gpt-4o-mini",
          status: "active",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      router.push(`/agents/${(data as { id: string }).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deploy failed");
      setDeploying(false);
    }
  }

  const exitConfig = generated?.config?.exit as Record<string, number> | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["prompt", "preview", "deploy"] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                step === s
                  ? "bg-emerald-600 text-white"
                  : (["prompt", "preview", "deploy"].indexOf(step) > i)
                    ? "bg-emerald-900/50 text-emerald-400"
                    : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {["prompt", "preview", "deploy"].indexOf(step) > i ? (
                <Check className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && <div className="h-px w-8 bg-zinc-800 sm:w-16" />}
          </div>
        ))}
      </div>

      {/* Step 1: Prompt */}
      {step === "prompt" && (
        <>
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Describe Your Strategy
          </CardTitle>
          <CardDescription className="mt-1">
            Tell us what you want in plain English. The AI will design entry and exit signals.
          </CardDescription>

          <div className="mt-6 space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Build a Gold and EUR/USD agent that uses RSI reversals with 2:1 reward ratio on H1..."
              rows={5}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />

            <div>
              <p className="mb-2 text-xs text-zinc-500">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-emerald-800 hover:text-emerald-400"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              onClick={handleGenerate}
              loading={generating}
              disabled={!prompt.trim()}
              className="w-full"
            >
              {generating ? (
                "Generating strategy..."
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Agent
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Templates */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-100">Or start from a template</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AGENT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t)}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-colors hover:border-emerald-800 hover:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200">{t.name}</span>
                  <Badge variant={t.agent_type === "systematic" ? "info" : "warning"}>
                    {t.agent_type}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{t.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
        </>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && generated && (
        <div className="space-y-4">
          <Card>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-emerald-400" />
              {generated.name}
            </CardTitle>
            <CardDescription className="mt-1">{generated.description}</CardDescription>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={generated.agent_type === "systematic" ? "info" : "warning"}>
                  {generated.agent_type === "systematic" ? (
                    <><Zap className="mr-1 h-3 w-3" /> Systematic</>
                  ) : (
                    <><Brain className="mr-1 h-3 w-3" /> Discretionary</>
                  )}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Instruments</p>
                  <p className="mt-1 text-sm text-zinc-200">{generated.portfolio_summary || "Single instrument"}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Exit Levels</p>
                  <p className="mt-1 text-sm text-zinc-200">
                    SL: {exitConfig?.stop_loss_pct ?? "—"}% · TP: {exitConfig?.take_profit_pct ?? "—"}%
                  </p>
                </div>
              </div>

              {/* Trading Rules */}
              {(generated.config as Record<string, unknown>)?.rules ? (
                <div className="rounded-2xl border border-zinc-800/40 bg-zinc-900/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Trading Rules</p>
                  <RuleDisplay rules={(generated.config as Record<string, unknown>).rules as Record<string, unknown>} />
                </div>
              ) : null}

              {/* Raw config */}
              <details className="rounded-2xl border border-zinc-800/40 bg-zinc-900/30">
                <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-zinc-600 hover:text-zinc-400">
                  View raw config JSON
                </summary>
                <pre className="max-h-48 overflow-auto px-4 pb-3 text-xs text-zinc-500">
                  {JSON.stringify(generated.config, null, 2)}
                </pre>
              </details>
            </div>
          </Card>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("prompt")}>
              <ArrowLeft className="h-4 w-4" />
              Edit Prompt
            </Button>
            <Button className="flex-1" onClick={() => setStep("deploy")}>
              Review & Deploy
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Deploy */}
      {step === "deploy" && generated && (
        <div className="space-y-4">
          <Card>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-emerald-400" />
              Ready to Deploy
            </CardTitle>
            <CardDescription className="mt-1">
              Review your agent and deploy it to start generating trading signals.
            </CardDescription>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Name</p>
                  <p className="mt-1 text-sm font-medium text-zinc-200">{generated.name}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Type</p>
                  <p className="mt-1 text-sm text-zinc-200">{generated.agent_type}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Instruments</p>
                  <p className="mt-1 text-sm text-zinc-200">{generated.portfolio_summary || "Single instrument"}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Exit Levels</p>
                  <p className="mt-1 text-sm text-zinc-200">
                    SL: {exitConfig?.stop_loss_pct ?? "—"}% · TP: {exitConfig?.take_profit_pct ?? "—"}%
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-400">
                  Agents are signal providers — they generate entry/exit signals and are tracked by gross return %.
                  No real money is involved.
                </p>
              </div>
            </div>
          </Card>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("preview")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="flex-1" onClick={handleDeploy} loading={deploying}>
              <Rocket className="h-4 w-4" />
              Deploy Agent
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
