"use client";

import { Slider } from "@/components/ui/slider";

export function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const shown = format ? format(value) : Number.isInteger(step) ? String(Math.round(value)) : value.toFixed(2);
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between text-[11px] tracking-wide text-muted-foreground">
        {label}
        <span className="font-mono text-foreground">{shown}</span>
      </span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => onChange(values[0] ?? value)}
      />
    </label>
  );
}
