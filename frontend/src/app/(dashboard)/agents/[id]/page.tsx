"use client";

import { AgentStatusBadge } from "@/components/agents/agent-status-badge";
import { TradingViewWidget } from "@/components/trading/trading-view-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { useAgent } from "@/hooks/use-agents";
import { useTrades } from "@/hooks/use-trades";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Loader2, Pause, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { agent, loading: agentLoading, refetch } = useAgent(id);
  const { trades, loading: tradesLoading } = useTrades(id);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleToggleStatus() {
    if (!agent) return;
    const newStatus = agent.status === "active" ? "paused" : "active";
    setActionLoading("toggle");

    const supabase = createClient();
    await (supabase.from as Function)("agents")
      .update({ status: newStatus })
      .eq("id", agent.id);

    await refetch();
    setActionLoading(null);
  }

  async function handleDelete() {
    if (!agent || !confirm("Are you sure you want to delete this agent? This cannot be undone.")) return;
    setActionLoading("delete");

    const supabase = createClient();
    await (supabase.from as Function)("agents")
      .delete()
      .eq("id", agent.id);

    router.push("/agents");
  }

  if (agentLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="py-32 text-center text-zinc-500">
        Agent not found.
      </div>
    );
  }

  const closedTrades = trades.filter((t) => t.status === "closed");
  const winningTrades = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Agent header with gradient accent */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/40 bg-zinc-900/30 p-6 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-cyan-500/5" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{agent.name}</h1>
              <AgentStatusBadge status={agent.status} />
            </div>
            {agent.description && (
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{agent.description}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Badge variant={agent.type === "systematic" ? "info" : "warning"}>
                {agent.type}
              </Badge>
              <span className="text-xs text-zinc-600">
                {agent.instrument.replace("_", "/")} &middot; {agent.timeframe}
              </span>
            </div>
          </div>

        <div className="flex items-center gap-2">
          {agent.status !== "killed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              loading={actionLoading === "toggle"}
            >
              {agent.status === "active" ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              )}
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={actionLoading === "delete"}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
        </div>
      </div>

      {/* Performance stats */}
      <div className="stagger-children grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total P&L", value: formatCurrency(totalPnl) },
          { label: "ROI", value: formatPercent(0) },
          { label: "Win Rate", value: `${winRate.toFixed(1)}%` },
          { label: "Trades", value: String(trades.length) },
          { label: "Max DD", value: `${agent.max_drawdown_pct}%` },
          { label: "Open", value: String(trades.filter((t) => t.status === "open").length) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-800/40 bg-zinc-900/30 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">{stat.label}</p>
              <p className="mt-1.5 text-xl font-bold tracking-tight text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardContent>
          <TradingViewWidget
            instrument={agent.instrument}
            granularity={agent.timeframe}
            agentId={agent.id}
            height={500}
          />
        </CardContent>
      </Card>

      {/* Trades table */}
      <Card>
        <CardTitle>Trade History</CardTitle>
        <CardContent className="mt-4">
          {tradesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : trades.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No trades yet. Agent will start trading when market conditions match.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="text-xs">
                      {new Date(trade.opened_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={trade.direction === "buy" ? "success" : "danger"}>
                        {trade.direction.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{Number(trade.entry_price).toFixed(5)}</TableCell>
                    <TableCell>
                      {trade.exit_price ? Number(trade.exit_price).toFixed(5) : "—"}
                    </TableCell>
                    <TableCell>{Number(trade.quantity).toFixed(0)}</TableCell>
                    <TableCell>
                      {trade.pnl != null ? (
                        <span className={trade.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {formatCurrency(trade.pnl)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={trade.status === "open" ? "info" : "default"}>
                        {trade.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
