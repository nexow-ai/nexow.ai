import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Plus } from "lucide-react";
import Link from "next/link";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">My Agents</h1>
          <p className="text-sm text-zinc-400">
            Manage your algorithmic trading agents.
          </p>
        </div>
        <Link href="/agents/new">
          <Button>
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-zinc-800 p-4">
              <Bot className="h-8 w-8 text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-200">No agents yet</h3>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Create your first trading agent using natural language. Just describe
              your strategy and our AI will handle the rest.
            </p>
            <Link href="/agents/new" className="mt-6">
              <Button>
                <Plus className="h-4 w-4" />
                Create Your First Agent
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
