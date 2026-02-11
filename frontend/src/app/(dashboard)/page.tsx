import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Activity, Bot, DollarSign, TrendingUp } from "lucide-react";

const stats = [
  {
    title: "Active Agents",
    value: "0",
    change: "+0%",
    icon: Bot,
    color: "text-emerald-400",
  },
  {
    title: "Total P&L",
    value: "$0.00",
    change: "+0%",
    icon: DollarSign,
    color: "text-cyan-400",
  },
  {
    title: "Win Rate",
    value: "0%",
    change: "+0%",
    icon: TrendingUp,
    color: "text-amber-400",
  },
  {
    title: "Open Trades",
    value: "0",
    change: "+0",
    icon: Activity,
    color: "text-purple-400",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-400">
          Overview of your trading agents and performance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold text-zinc-100">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-emerald-400">{stat.change}</p>
                </div>
                <div className={`rounded-lg bg-zinc-800 p-3 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Recent Trades</CardTitle>
          <CardContent>
            <div className="flex h-48 items-center justify-center text-zinc-500">
              <p>No trades yet. Create an agent to get started.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Performance Chart</CardTitle>
          <CardContent>
            <div className="flex h-48 items-center justify-center text-zinc-500">
              <p>Performance data will appear here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
