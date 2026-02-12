"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { AGENT_TEMPLATES, type AgentTemplate } from "@/lib/agent-templates";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Brain,
  Check,
  Loader2,
  Rocket,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type WizardStep = "prompt" | "preview" | "risk" | "deploy";

const EXAMPLE_PROMPTS = [
  "Cautious Gold trader using RSI on H1 timeframe",
  "Aggressive EUR/USD + GBP/USD portfolio with MACD and EMA confluence",
  "Smart news-aware agent that trades XAU/USD based on market sentiment",
  "Balanced forex portfolio: EUR/USD 40%, GBP/USD 30%, USD/JPY 30% with Bollinger Bands",
  "Conservative discretionary agent analyzing EUR/USD with web search and economic calendar",
];

const INSTRUMENTS = [
  "EUR_USD", "GBP_USD", "USD_JPY", "XAU_USD",
  "USD_CAD", "AUD_USD", "NZD_USD", "USD_CHF",
];

interface GeneratedAgent {
  agent_type: string;
  name: string;
  description: string;
  risk_summary: string;
  portfolio_summary: string;
  config: Record<string, unknown>;
}

export default function NewAgentPage() {
  const router = useRouter();

  // Wizard state
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
      risk_summary: "",
      portfolio_summary: "",
      config: template.config,
    });
    const risk = (template.config.risk ?? {}) as Record<string, number>;
    setRiskOverrides({
      risk_per_trade_pct: risk.risk_per_trade_pct ?? 1.0,
      max_drawdown_pct: risk.max_drawdown_pct ?? 10.0,
      max_daily_loss_pct: risk.max_daily_loss_pct ?? 3.0,
      stop_loss_pips: risk.stop_loss_pips ?? 20,
      risk_reward_ratio: risk.risk_reward_ratio ?? 2.0,
      max_concurrent_trades: risk.max_concurrent_trades ?? 3,
    });
    setStep("preview");
  }

  // Risk overrides
  const [riskOverrides, setRiskOverrides] = useState({
    risk_per_trade_pct: 1.0,
    max_drawdown_pct: 10.0,
    max_daily_loss_pct: 3.0,
    stop_loss_pips: 20,
    risk_reward_ratio: 2.0,
    max_concurrent_trades: 3,
  });

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

      // Pre-fill risk overrides from generated config
      const risk = (data.config?.risk ?? {}) as Record<string, number>;
      setRiskOverrides({
        risk_per_trade_pct: risk.risk_per_trade_pct ?? 1.0,
        max_drawdown_pct: risk.max_drawdown_pct ?? 10.0,
        max_daily_loss_pct: risk.max_daily_loss_pct ?? 3.0,
        stop_loss_pips: risk.stop_loss_pips ?? 20,
        risk_reward_ratio: risk.risk_reward_ratio ?? 2.0,
        max_concurrent_trades: risk.max_concurrent_trades ?? 3,
      });

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

      // Merge risk overrides into config
      const config = { ...generated.config };
      (config as Record<string, unknown>).risk = {
        ...((config as Record<string, unknown>).risk as Record<string, unknown> ?? {}),
        ...riskOverrides,
      };

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
          risk_config: riskOverrides,
          max_drawdown_pct: riskOverrides.max_drawdown_pct,
          risk_per_trade_pct: riskOverrides.risk_per_trade_pct,
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["prompt", "preview", "risk", "deploy"] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                step === s
                  ? "bg-emerald-600 text-white"
                  : (["prompt", "preview", "risk", "deploy"].indexOf(step) > i)
                    ? "bg-emerald-900/50 text-emerald-400"
                    : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {["prompt", "preview", "risk", "deploy"].indexOf(step) > i ? (
                <Check className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 3 && <div className="h-px w-8 bg-zinc-800 sm:w-16" />}
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
            Tell us what you want in plain English. The AI will design a complete trading agent.
          </CardDescription>

          <div className="mt-6 space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Build a cautious Gold and EUR/USD portfolio that uses RSI reversals with 2:1 risk-reward ratio..."
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

      {/* Step 2: AI Preview */}
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
                  <p className="text-xs text-zinc-500">Portfolio</p>
                  <p className="mt-1 text-sm text-zinc-200">{generated.portfolio_summary || "Single instrument"}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Risk Profile</p>
                  <p className="mt-1 text-sm text-zinc-200">{generated.risk_summary || "Default risk settings"}</p>
                </div>
              </div>

              {/* Strategy details */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="mb-2 text-xs text-zinc-500">Strategy Config</p>
                <pre className="max-h-48 overflow-auto text-xs text-zinc-400">
                  {JSON.stringify(generated.config, null, 2)}
                </pre>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("prompt")}>
              <ArrowLeft className="h-4 w-4" />
              Edit Prompt
            </Button>
            <Button className="flex-1" onClick={() => setStep("risk")}>
              Configure Risk
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Risk Configuration */}
      {step === "risk" && (
        <div className="space-y-4">
          <Card>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" />
              Risk Management
            </CardTitle>
            <CardDescription className="mt-1">
              Fine-tune your risk parameters. These override the AI-generated defaults.
            </CardDescription>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Risk per Trade (%)"
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={riskOverrides.risk_per_trade_pct}
                onChange={(e) => setRiskOverrides((r) => ({ ...r, risk_per_trade_pct: parseFloat(e.target.value) || 1 }))}
              />
              <Input
                label="Max Drawdown (%)"
                type="number"
                step="1"
                min="1"
                max="50"
                value={riskOverrides.max_drawdown_pct}
                onChange={(e) => setRiskOverrides((r) => ({ ...r, max_drawdown_pct: parseFloat(e.target.value) || 10 }))}
              />
              <Input
                label="Max Daily Loss (%)"
                type="number"
                step="0.5"
                min="0.5"
                max="20"
                value={riskOverrides.max_daily_loss_pct}
                onChange={(e) => setRiskOverrides((r) => ({ ...r, max_daily_loss_pct: parseFloat(e.target.value) || 3 }))}
              />
              <Input
                label="Stop Loss (pips)"
                type="number"
                step="1"
                min="1"
                max="500"
                value={riskOverrides.stop_loss_pips}
                onChange={(e) => setRiskOverrides((r) => ({ ...r, stop_loss_pips: parseInt(e.target.value) || 20 }))}
              />
              <Input
                label="Risk:Reward Ratio"
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                value={riskOverrides.risk_reward_ratio}
                onChange={(e) => setRiskOverrides((r) => ({ ...r, risk_reward_ratio: parseFloat(e.target.value) || 2 }))}
              />
              <Input
                label="Max Concurrent Trades"
                type="number"
                step="1"
                min="1"
                max="20"
                value={riskOverrides.max_concurrent_trades}
                onChange={(e) => setRiskOverrides((r) => ({ ...r, max_concurrent_trades: parseInt(e.target.value) || 3 }))}
              />
            </div>

            {/* Risk level indicator */}
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Risk Level</p>
              <div className="mt-2 flex items-center gap-3">
                {riskOverrides.risk_per_trade_pct <= 1 && riskOverrides.max_drawdown_pct <= 10 ? (
                  <Badge variant="success">Conservative</Badge>
                ) : riskOverrides.risk_per_trade_pct <= 2 && riskOverrides.max_drawdown_pct <= 20 ? (
                  <Badge variant="info">Balanced</Badge>
                ) : (
                  <Badge variant="danger">Aggressive</Badge>
                )}
                <span className="text-xs text-zinc-400">
                  {riskOverrides.risk_per_trade_pct}% risk, {riskOverrides.risk_reward_ratio}:1 R:R, {riskOverrides.max_drawdown_pct}% max DD
                </span>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("preview")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="flex-1" onClick={() => setStep("deploy")}>
              Review & Deploy
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Deploy */}
      {step === "deploy" && generated && (
        <div className="space-y-4">
          <Card>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-emerald-400" />
              Ready to Deploy
            </CardTitle>
            <CardDescription className="mt-1">
              Review your agent configuration and deploy it to start trading.
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
                  <p className="text-xs text-zinc-500">Portfolio</p>
                  <p className="mt-1 text-sm text-zinc-200">{generated.portfolio_summary || "Single instrument"}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Risk</p>
                  <p className="mt-1 text-sm text-zinc-200">
                    {riskOverrides.risk_per_trade_pct}% risk, {riskOverrides.risk_reward_ratio}:1 R:R
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Max Drawdown</p>
                  <p className="mt-1 text-sm text-zinc-200">{riskOverrides.max_drawdown_pct}%</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-xs text-zinc-500">Max Trades</p>
                  <p className="mt-1 text-sm text-zinc-200">{riskOverrides.max_concurrent_trades}</p>
                </div>
              </div>
            </div>
          </Card>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("risk")}>
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
