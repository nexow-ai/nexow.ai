"use client";

import { AgentStatusBadge } from "@/components/agents/agent-status-badge";
import { TradingViewWidget } from "@/components/trading/trading-view-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Pause, Play, Trash2 } from "lucide-react";
import { use } from "react";

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = use(params);

  // Placeholder data — will be replaced with real-time Supabase data
  const agent = {
    id,
    name: "Gold Dip Buyer",
    description: "A cautious Gold trader that buys dips using RSI reversal strategy",
    type: "systematic" as const,
    instrument: "XAU_USD",
    timeframe: "M5",
    status: "active" as const,
    max_drawdown_pct: 10,
    risk_per_trade_pct: 1,
  };

  const performance = {
    total_trades: 0,
    win_rate: 0,
    total_pnl: 0,
    roi_pct: 0,
    max_drawdown: 0,
    sharpe_ratio: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">{agent.name}</h1>
              <AgentStatusBadge status={agent.status} />
            </div>
            <p className="mt-1 text-sm text-zinc-400">{agent.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="info">{agent.type}</Badge>
              <span className="text-xs text-zinc-500">
                {agent.instrument} &middot; {agent.timeframe}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Pause className="h-4 w-4" />
            Pause
          </Button>
          <Button variant="danger" size="sm">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Performance stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total P&L", value: formatCurrency(performance.total_pnl) },
          { label: "ROI", value: formatPercent(performance.roi_pct) },
          { label: "Win Rate", value: `${performance.win_rate}%` },
          { label: "Trades", value: String(performance.total_trades) },
          { label: "Max DD", value: `${performance.max_drawdown}%` },
          { label: "Sharpe", value: performance.sharpe_ratio.toFixed(2) },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <p className="text-xs text-zinc-500">{stat.label}</p>
              <p className="mt-1 text-lg font-bold text-zinc-100">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardTitle>Price Chart</CardTitle>
        <CardContent className="mt-4">
          <TradingViewWidget />
        </CardContent>
      </Card>

      {/* Trades table */}
      <Card>
        <CardTitle>Trade History</CardTitle>
        <CardContent className="mt-4">
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
              <TableRow>
                <TableCell colSpan={7} className="text-center text-zinc-500 py-8">
                  No trades yet. Agent will start trading when market conditions match.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
