"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  type IChartApi,
  type Time,
  CandlestickSeries,
  ColorType,
  createSeriesMarkers,
} from "lightweight-charts";
import { createClient } from "@/lib/supabase/client";

interface TradingViewWidgetProps {
  instrument?: string;
  granularity?: string;
  agentId?: string;
  className?: string;
  height?: number;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function TradingViewWidget({
  instrument = "EUR_USD",
  granularity = "M5",
  agentId,
  className,
  height = 500,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ReturnType<IChartApi["addSeries"]> | null>(null);
  const candlesRef = useRef<CandleData[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");

  const fetchCandles = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/candles?instrument=${instrument}&granularity=${granularity}&count=200`
      );
      if (!res.ok) throw new Error("Failed to fetch candles");
      const data = await res.json();
      return data.candles as CandleData[];
    } catch {
      return null;
    }
  }, [instrument, granularity]);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/price?instrument=${instrument}`);
      if (!res.ok) return null;
      return (await res.json()) as { mid: number; time: number };
    } catch {
      return null;
    }
  }, [instrument]);

  const fetchTrades = useCallback(async () => {
    if (!agentId) return [];
    try {
      const supabase = createClient();
      const { data } = await (supabase.from as Function)("trades")
        .select("*")
        .eq("agent_id", agentId)
        .order("opened_at", { ascending: true });
      return (data ?? []) as Array<{
        opened_at: string;
        direction: string;
        entry_price: number;
      }>;
    } catch {
      return [];
    }
  }, [agentId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#52525b",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#18181b" },
        horzLines: { color: "#18181b" },
      },
      width: containerRef.current.clientWidth,
      height,
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#27272a",
      },
      crosshair: {
        vertLine: { color: "#10b981", width: 1, style: 2, labelBackgroundColor: "#10b981" },
        horzLine: { color: "#10b981", width: 1, style: 2, labelBackgroundColor: "#10b981" },
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#10b981",
      wickDownColor: "#ef4444",
      wickUpColor: "#10b981",
    });
    candleSeriesRef.current = candleSeries;

    async function loadData() {
      const candles = await fetchCandles();
      if (!candles || candles.length === 0) {
        setStatus("error");
        return;
      }

      candlesRef.current = candles;

      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

      // Trade markers — snap each trade to the nearest candle time
      const trades = await fetchTrades();
      if (trades.length > 0 && candles.length > 0) {
        const candleTimes = candles.map((c) => c.time);

        const snapToCandle = (tradeEpoch: number): number => {
          let closest = candleTimes[0];
          let minDiff = Math.abs(tradeEpoch - closest);
          for (const ct of candleTimes) {
            const diff = Math.abs(tradeEpoch - ct);
            if (diff < minDiff) {
              minDiff = diff;
              closest = ct;
            }
          }
          return closest;
        };

        const markers = trades.map((trade) => {
          const tradeEpoch = Math.floor(new Date(trade.opened_at).getTime() / 1000);
          return {
            time: snapToCandle(tradeEpoch) as Time,
            position: (trade.direction === "buy" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
            color: trade.direction === "buy" ? "#10b981" : "#ef4444",
            shape: (trade.direction === "buy" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
            text: `${trade.direction.toUpperCase()} @ ${Number(trade.entry_price).toFixed(5)}`,
          };
        });
        markers.sort((a, b) => (a.time as number) - (b.time as number));
        createSeriesMarkers(candleSeries, markers);
      }

      chart.timeScale().fitContent();
      setStatus("live");
    }

    loadData();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    // Real-time price polling
    pollingRef.current = setInterval(async () => {
      const price = await fetchPrice();
      if (!price || !candleSeriesRef.current) return;

      const candles = candlesRef.current;
      if (candles.length === 0) return;

      const lastCandle = candles[candles.length - 1];

      const granMap: Record<string, number> = {
        M1: 60, M5: 300, M15: 900, M30: 1800,
        H1: 3600, H4: 14400, D: 86400,
      };
      const duration = granMap[granularity] || 300;
      const candleEnd = lastCandle.time + duration;

      if (price.time >= lastCandle.time && price.time < candleEnd) {
        lastCandle.close = price.mid;
        lastCandle.high = Math.max(lastCandle.high, price.mid);
        lastCandle.low = Math.min(lastCandle.low, price.mid);
        candleSeriesRef.current.update({
          time: lastCandle.time as Time,
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
        });
      } else if (price.time >= candleEnd) {
        const newCandle: CandleData = {
          time: candleEnd,
          open: price.mid,
          high: price.mid,
          low: price.mid,
          close: price.mid,
          volume: 0,
        };
        candles.push(newCandle);
        candleSeriesRef.current.update({
          time: newCandle.time as Time,
          open: newCandle.open,
          high: newCandle.high,
          low: newCandle.low,
          close: newCandle.close,
        });
      }
    }, 5000);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (pollingRef.current) clearInterval(pollingRef.current);
      chart.remove();
    };
  }, [instrument, granularity, agentId, height, fetchCandles, fetchPrice, fetchTrades]);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-200">{instrument.replace("_", "/")}</span>
          <span className="rounded-lg bg-zinc-800/50 px-2 py-0.5 text-zinc-500">{granularity}</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "live" && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-emerald-400">Live</span>
            </span>
          )}
          {status === "loading" && <span className="text-zinc-600">Loading...</span>}
          {status === "error" && <span className="text-red-400">Disconnected</span>}
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
