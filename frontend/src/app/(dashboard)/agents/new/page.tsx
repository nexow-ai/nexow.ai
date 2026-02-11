import { AgentForm } from "@/components/agents/agent-form";

export default function NewAgentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Create Agent</h1>
        <p className="text-sm text-zinc-400">
          Describe your trading idea in plain English. The AI Agent Factory will
          build it for you.
        </p>
      </div>

      <AgentForm />
    </div>
  );
}
