"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  type IChartApi,
  type Time,
  CandlestickSeries,
  LineSeries,
  ColorType,
  createSeriesMarkers,
} from "lightweight-charts";
import { createClient } from "@/lib/supabase/client";
import {
  calcEMA,
  calcBollingerBands,
  calcRSI,
  type OhlcData,
} from "@/lib/indicators";

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
        textColor: "#71717a",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#1c1c1e" },
        horzLines: { color: "#1c1c1e" },
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

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#10b981",
      wickDownColor: "#ef4444",
      wickUpColor: "#10b981",
    });
    candleSeriesRef.current = candleSeries;

    // EMA lines
    const ema9Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const ema21Series = chart.addSeries(LineSeries, {
      color: "#8b5cf6",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Bollinger Bands
    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: "rgba(59, 130, 246, 0.5)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbMiddleSeries = chart.addSeries(LineSeries, {
      color: "rgba(59, 130, 246, 0.3)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: "rgba(59, 130, 246, 0.5)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // RSI (separate pane via priceScaleId)
    const rsiSeries = chart.addSeries(LineSeries, {
      color: "#06b6d4",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      priceScaleId: "rsi",
    });

    const rsiOverbought = chart.addSeries(LineSeries, {
      color: "rgba(239, 68, 68, 0.3)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceScaleId: "rsi",
    });

    const rsiOversold = chart.addSeries(LineSeries, {
      color: "rgba(16, 185, 129, 0.3)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceScaleId: "rsi",
    });

    chart.priceScale("rsi").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Load data
    async function loadData() {
      const candles = await fetchCandles();
      if (!candles || candles.length === 0) {
        setStatus("error");
        return;
      }

      candlesRef.current = candles;
      const ohlcData: OhlcData[] = candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

      // Calculate and set indicators
      const ema9 = calcEMA(ohlcData, 9);
      const ema21 = calcEMA(ohlcData, 21);
      const bb = calcBollingerBands(ohlcData, 20, 2);
      const rsi = calcRSI(ohlcData, 14);

      ema9Series.setData(ema9.map((p) => ({ time: p.time as Time, value: p.value })));
      ema21Series.setData(ema21.map((p) => ({ time: p.time as Time, value: p.value })));
      bbUpperSeries.setData(bb.upper.map((p) => ({ time: p.time as Time, value: p.value })));
      bbMiddleSeries.setData(bb.middle.map((p) => ({ time: p.time as Time, value: p.value })));
      bbLowerSeries.setData(bb.lower.map((p) => ({ time: p.time as Time, value: p.value })));
      rsiSeries.setData(rsi.map((p) => ({ time: p.time as Time, value: p.value })));

      if (rsi.length >= 2) {
        const rsiTimes = [rsi[0].time, rsi[rsi.length - 1].time];
        rsiOverbought.setData(rsiTimes.map((t) => ({ time: t as Time, value: 70 })));
        rsiOversold.setData(rsiTimes.map((t) => ({ time: t as Time, value: 30 })));
      }

      // Trade markers
      const trades = await fetchTrades();
      if (trades.length > 0) {
        const markers = trades.map((trade) => ({
          time: (Math.floor(new Date(trade.opened_at).getTime() / 1000)) as Time,
          position: (trade.direction === "buy" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
          color: trade.direction === "buy" ? "#10b981" : "#ef4444",
          shape: (trade.direction === "buy" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
          text: `${trade.direction.toUpperCase()} @ ${trade.entry_price}`,
        }));
        markers.sort((a, b) => (a.time as number) - (b.time as number));
        createSeriesMarkers(candleSeries, markers);
      }

      chart.timeScale().fitContent();
      setStatus("live");
    }

    loadData();

    // Resize handler
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

      const candleStart = lastCandle.time;
      const candleEnd = candleStart + duration;

      if (price.time >= candleStart && price.time < candleEnd) {
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
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="font-medium text-zinc-300">{instrument.replace("_", "/")}</span>
          <span className="text-zinc-500">{granularity}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
            <span className="text-zinc-500">EMA 9</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
            <span className="text-zinc-500">EMA 21</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
            <span className="text-zinc-500">BB(20,2)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#06b6d4" }} />
            <span className="text-zinc-500">RSI 14</span>
          </span>
          {status === "live" && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-emerald-400">Live</span>
            </span>
          )}
          {status === "loading" && (
            <span className="text-zinc-500">Loading...</span>
          )}
          {status === "error" && (
            <span className="text-red-400">Disconnected</span>
          )}
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
