"use client";

import { useState } from "react";
import { Activity, Clock, Zap, TrendingUp, ShieldCheck } from "lucide-react";

interface BarData {
  timeLabel: string;
  players: number;
  maxPlayers: number;
  ping: number;
  uptimePercent: number;
  status: "optimal" | "degraded" | "offline";
}

// Generate realistic 24-hour activity telemetry points
const generateTelemetry = (): BarData[] => {
  const bars: BarData[] = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour = time.getHours();
    const timeLabel = `${hour.toString().padStart(2, "0")}:00`;
    
    // Simulate player activity curve (peak in evening 17:00 - 23:00)
    let factor = 0.3;
    if (hour >= 16 && hour <= 23) factor = 0.75 + Math.sin(hour) * 0.15;
    else if (hour >= 12 && hour < 16) factor = 0.5 + Math.cos(hour) * 0.1;
    else if (hour >= 1 && hour <= 7) factor = 0.15 + (hour / 100);

    const players = Math.round(120 * factor + (i % 3) * 4);
    const ping = 15 + Math.round((24 - i) * 0.3 + (i % 4) * 2);
    
    bars.push({
      timeLabel,
      players,
      maxPlayers: 500,
      ping,
      uptimePercent: 100,
      status: "optimal",
    });
  }
  return bars;
};

export function ServerActivityGraph() {
  const [bars] = useState<BarData[]>(generateTelemetry);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeBar = hoveredIndex !== null ? bars[hoveredIndex] : bars[bars.length - 1];
  const peakPlayers = Math.max(...bars.map((b) => b.players));

  return (
    <div className="panel p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-strong/40 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent-bright">
            <Activity size={20} />
          </span>
          <div>
            <h3 className="font-display text-xl font-bold">24-Hour Telemetry & Activity</h3>
            <p className="text-xs text-muted">Player traffic, server load, and uptime health over the last 24 hours.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="chip flex items-center gap-1.5 border-success/40 bg-success/10 text-success">
            <ShieldCheck size={13} /> 99.9% Operational
          </span>
          <span className="chip flex items-center gap-1.5">
            <TrendingUp size={13} /> Peak: {peakPlayers} Online
          </span>
        </div>
      </div>

      {/* Dynamic Hover Card Info */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line-strong/40 bg-ink/5 p-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
            <Clock size={12} /> Time Interval
          </span>
          <p className="telemetry mt-1 text-lg font-bold">{activeBar.timeLabel}</p>
        </div>
        <div className="rounded-xl border border-line-strong/40 bg-ink/5 p-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Players Online</span>
          <p className="telemetry mt-1 text-lg font-bold text-accent-bright">
            {activeBar.players} <span className="text-xs font-normal text-muted">/ {activeBar.maxPlayers}</span>
          </p>
        </div>
        <div className="rounded-xl border border-line-strong/40 bg-ink/5 p-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
            <Zap size={12} /> Avg Latency
          </span>
          <p className="telemetry mt-1 text-lg font-bold text-success">{activeBar.ping}ms</p>
        </div>
        <div className="rounded-xl border border-line-strong/40 bg-ink/5 p-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Status</span>
          <p className="telemetry mt-1 text-lg font-bold text-success">100% Online</p>
        </div>
      </div>

      {/* Bar Chart Bars */}
      <div className="mt-6">
        <div className="flex h-36 items-end gap-1.5 rounded-xl border border-line-strong/30 bg-ink/10 p-3">
          {bars.map((bar, idx) => {
            const heightPercent = Math.max(12, Math.round((bar.players / (peakPlayers * 1.1)) * 100));
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group relative flex-1 flex flex-col items-center h-full justify-end cursor-pointer"
              >
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t transition-all duration-200 ${
                    isHovered
                      ? "bg-accent-bright shadow-[0_0_12px_rgba(168,85,247,0.8)] scale-y-105"
                      : "bg-gradient-to-t from-accent/40 to-accent-bright/70 hover:from-accent hover:to-accent-bright"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Time X-Axis */}
        <div className="mt-2.5 flex justify-between px-1 text-[11px] font-mono text-muted">
          <span>24h ago</span>
          <span>18h ago</span>
          <span>12h ago</span>
          <span>6h ago</span>
          <span>Now</span>
        </div>
      </div>
    </div>
  );
}
