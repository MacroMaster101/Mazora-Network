"use client";

import { useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { isValidHexColor } from "@/lib/auth/role-catalog-core";
import { hsvToHex, hexToHsv } from "@/lib/color-convert";

const SWATCHES = ["#f59e0b", "#f43f5e", "#e11d48", "#6366f1", "#3b82f6", "#06b6d4", "#a855f7", "#ec4899", "#10b981", "#22c55e", "#84cc16", "#64748b"];

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(isValidHexColor(value) ? value : "#a855f7"));
  const [text, setText] = useState(value);
  const [dropper, setDropper] = useState<EyeDropperCtor | null>(null);
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value);
    if (isValidHexColor(value)) setHsv(hexToHsv(value));
  }, [value]);

  useEffect(() => {
    const ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    setDropper(() => ctor ?? null);
  }, []);

  const emit = (h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    onChange(hsvToHex(h, s, v));
  };

  const pickFromArea = (clientX: number, clientY: number) => {
    const rect = area.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    emit(hsv[0], s, v);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Preset colours">
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            role="option"
            aria-selected={value === hex}
            aria-label={hex}
            onClick={() => onChange(hex)}
            className={`h-7 w-7 rounded-full border-2 ${value === hex ? "border-ink" : "border-transparent"}`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>

      <div
        ref={area}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={value}
        aria-valuenow={Math.round(hsv[1] * hsv[2] * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickFromArea(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => e.buttons === 1 && pickFromArea(e.clientX, e.clientY)}
        onKeyDown={(e) => {
          const step = 0.02;
          if (e.key === "ArrowRight") emit(hsv[0], Math.min(1, hsv[1] + step), hsv[2]);
          if (e.key === "ArrowLeft") emit(hsv[0], Math.max(0, hsv[1] - step), hsv[2]);
          if (e.key === "ArrowUp") emit(hsv[0], hsv[1], Math.min(1, hsv[2] + step));
          if (e.key === "ArrowDown") emit(hsv[0], hsv[1], Math.max(0, hsv[2] - step));
        }}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-lg"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hsv[0], 1, 1)})` }}
      >
        <span
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv[1] * 100}%`, bottom: `${hsv[2] * 100}%` }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={359}
        value={Math.round(hsv[0])}
        aria-label="Hue"
        onChange={(e) => emit(Number(e.target.value), hsv[1], hsv[2])}
        className="w-full"
        style={{ accentColor: hsvToHex(hsv[0], 1, 1) }}
      />

      <div className="flex items-center gap-2">
        <span className="h-9 w-9 shrink-0 rounded-lg border border-line" style={{ backgroundColor: value }} aria-hidden />
        <input
          value={text}
          onChange={(e) => {
            const next = e.target.value.trim().toLowerCase();
            setText(next);
            if (isValidHexColor(next)) onChange(next);
          }}
          aria-label="Hex colour"
          aria-invalid={!isValidHexColor(text)}
          maxLength={7}
          className="h-9 w-28 rounded-lg border border-line bg-surface px-2 font-mono text-sm"
        />
        {dropper && (
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1.5"
            onClick={async () => {
              try {
                const { sRGBHex } = await new dropper().open();
                const hex = sRGBHex.toLowerCase();
                if (isValidHexColor(hex)) onChange(hex);
              } catch {
                // Cancelled with Escape — nothing to do.
              }
            }}
          >
            <Pipette size={14} /> Pick from screen
          </button>
        )}
      </div>
      {!isValidHexColor(text) && <p className="text-xs text-danger">Use the form #rrggbb, e.g. #e11d48.</p>}
    </div>
  );
}
