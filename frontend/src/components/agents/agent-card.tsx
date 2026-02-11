import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentStatusBadge } from "./agent-status-badge";
import { Bot, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Database } from "@/lib/types/database";

type Agent = Database["public"]["Tables"]["agents"]["Row"];

interface AgentCardProps {
  agent: Agent;
  performance?: {
    total_pnl: number;
    win_rate: number;
    roi_pct: number;
    total_trades: number;
  };
}

export function AgentCard({ agent, performance }: AgentCardProps) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <Card hover className="cursor-pointer">
        <CardContent>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10">
                <Bot className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-100">{agent.name}</h3>
                <p className="text-xs text-zinc-500">{agent.instrument} &middot; {agent.timeframe}</p>
              </div>
            </div>
            <AgentStatusBadge status={agent.status} />
          </div>

          {agent.description && (
            <p className="mt-3 text-sm text-zinc-400 line-clamp-2">{agent.description}</p>
          )}

          <div className="mt-4 flex items-center gap-4">
            <Badge variant={agent.type === "systematic" ? "info" : "warning"}>
              {agent.type}
            </Badge>

            {performance && (
              <>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
                  <span className={performance.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {formatCurrency(performance.total_pnl)}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  {formatPercent(performance.roi_pct)} ROI
                </span>
                <span className="text-xs text-zinc-500">
                  {performance.win_rate.toFixed(0)}% WR
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
