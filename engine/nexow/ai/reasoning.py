"""LangGraph reasoning chains for discretionary agents."""

from __future__ import annotations

from typing import Any, TypedDict

import structlog
from langgraph.graph import END, StateGraph

logger = structlog.get_logger(__name__)


# ------------------------------------------------------------------
# State definition
# ------------------------------------------------------------------

class ReasoningState(TypedDict):
    """State that flows through the reasoning graph."""

    agent_config: dict[str, Any]
    market_context: dict[str, Any]
    personality: str
    analysis: str
    action: str
    confidence: float
    stop_loss: float | None
    take_profit: float | None
    reasoning: str
    step: int


# ------------------------------------------------------------------
# Graph nodes
# ------------------------------------------------------------------

async def analyze_market(state: ReasoningState) -> ReasoningState:
    """Analyze market data and produce a textual analysis."""
    ctx = state["market_context"]
    personality = state["personality"]

    price = ctx.get("current_price", 0)
    change = ctx.get("price_change_pct", 0)
    high = ctx.get("recent_high", 0)
    low = ctx.get("recent_low", 0)

    analysis_parts = [
        f"Current price: {price:.5f}",
        f"Recent change: {change:.2f}%",
        f"Range: {low:.5f} - {high:.5f}",
    ]

    if personality == "aggressive":
        analysis_parts.append("Personality: Looking for strong momentum entries.")
    elif personality == "cautious":
        analysis_parts.append("Personality: Prioritizing safety and confirmed signals.")
    else:
        analysis_parts.append("Personality: Balanced approach.")

    state["analysis"] = " | ".join(analysis_parts)
    state["step"] = state.get("step", 0) + 1
    return state


async def make_decision(state: ReasoningState) -> ReasoningState:
    """Based on analysis, decide on a trading action."""
    ctx = state["market_context"]
    personality = state["personality"]
    change = ctx.get("price_change_pct", 0)

    # Simple heuristic reasoning (in production, this calls an LLM)
    confidence_threshold = {"aggressive": 0.3, "cautious": 0.7, "balanced": 0.5}.get(personality, 0.5)

    if abs(change) < 0.05:
        state["action"] = "hold"
        state["confidence"] = 0.2
        state["reasoning"] = "Market is flat, no clear direction."
    elif change > 0.1:
        state["action"] = "buy"
        state["confidence"] = min(abs(change) / 1.0, 1.0)
        state["reasoning"] = f"Upward momentum detected ({change:.2f}%)."
    elif change < -0.1:
        state["action"] = "sell"
        state["confidence"] = min(abs(change) / 1.0, 1.0)
        state["reasoning"] = f"Downward momentum detected ({change:.2f}%)."
    else:
        state["action"] = "hold"
        state["confidence"] = 0.3
        state["reasoning"] = "Weak signal, waiting for confirmation."

    # Filter by confidence threshold
    if state["confidence"] < confidence_threshold and state["action"] != "hold":
        state["action"] = "hold"
        state["reasoning"] += f" Confidence {state['confidence']:.2f} below threshold {confidence_threshold}."

    state["step"] = state.get("step", 0) + 1
    return state


async def set_risk_levels(state: ReasoningState) -> ReasoningState:
    """Calculate stop-loss and take-profit based on action and config."""
    ctx = state["market_context"]
    price = ctx.get("current_price", 0)
    risk_config = state["agent_config"].get("risk", {})

    sl_pips = risk_config.get("stop_loss_pips")
    tp_pips = risk_config.get("take_profit_pips")

    # Default pip value (for forex majors, 1 pip ≈ 0.0001)
    pip = 0.0001
    if "JPY" in ctx.get("instrument", ""):
        pip = 0.01
    if "XAU" in ctx.get("instrument", ""):
        pip = 0.1

    if state["action"] == "buy":
        state["stop_loss"] = price - (sl_pips or 20) * pip
        state["take_profit"] = price + (tp_pips or 40) * pip
    elif state["action"] == "sell":
        state["stop_loss"] = price + (sl_pips or 20) * pip
        state["take_profit"] = price - (tp_pips or 40) * pip
    else:
        state["stop_loss"] = None
        state["take_profit"] = None

    state["step"] = state.get("step", 0) + 1
    return state


# ------------------------------------------------------------------
# Build the graph
# ------------------------------------------------------------------

def build_reasoning_graph() -> StateGraph:
    """Build the LangGraph reasoning chain for discretionary agents."""
    graph = StateGraph(ReasoningState)

    graph.add_node("analyze", analyze_market)
    graph.add_node("decide", make_decision)
    graph.add_node("risk", set_risk_levels)

    graph.set_entry_point("analyze")
    graph.add_edge("analyze", "decide")
    graph.add_edge("decide", "risk")
    graph.add_edge("risk", END)

    return graph


_compiled_graph = build_reasoning_graph().compile()


async def run_reasoning_chain(
    agent_config: dict[str, Any],
    market_context: dict[str, Any],
    personality: str = "cautious",
) -> dict[str, Any]:
    """
    Execute the reasoning graph and return the decision.

    Returns:
        Dict with keys: action, confidence, stop_loss, take_profit, reasoning
    """
    initial_state: ReasoningState = {
        "agent_config": agent_config,
        "market_context": market_context,
        "personality": personality,
        "analysis": "",
        "action": "hold",
        "confidence": 0.0,
        "stop_loss": None,
        "take_profit": None,
        "reasoning": "",
        "step": 0,
    }

    result = await _compiled_graph.ainvoke(initial_state)

    return {
        "action": result["action"],
        "confidence": result["confidence"],
        "stop_loss": result["stop_loss"],
        "take_profit": result["take_profit"],
        "reasoning": result["reasoning"],
    }
