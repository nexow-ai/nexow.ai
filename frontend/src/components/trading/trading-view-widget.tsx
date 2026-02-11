"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, CandlestickSeries, ColorType } from "lightweight-charts";

interface TradingViewWidgetProps {
  className?: string;
}

export function TradingViewWidget({ className }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#71717a",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      width: containerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: "#27272a",
      },
      rightPriceScale: {
        borderColor: "#27272a",
      },
      crosshair: {
        vertLine: { color: "#10b981", width: 1, style: 2 },
        horzLine: { color: "#10b981", width: 1, style: 2 },
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

    // Placeholder data
    candleSeries.setData([
      { time: "2026-01-01", open: 1.1050, high: 1.1080, low: 1.1020, close: 1.1060 },
      { time: "2026-01-02", open: 1.1060, high: 1.1100, low: 1.1040, close: 1.1090 },
      { time: "2026-01-03", open: 1.1090, high: 1.1120, low: 1.1070, close: 1.1075 },
      { time: "2026-01-06", open: 1.1075, high: 1.1110, low: 1.1050, close: 1.1100 },
      { time: "2026-01-07", open: 1.1100, high: 1.1130, low: 1.1080, close: 1.1085 },
      { time: "2026-01-08", open: 1.1085, high: 1.1120, low: 1.1060, close: 1.1115 },
      { time: "2026-01-09", open: 1.1115, high: 1.1150, low: 1.1095, close: 1.1140 },
      { time: "2026-01-10", open: 1.1140, high: 1.1160, low: 1.1100, close: 1.1110 },
    ]);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}
