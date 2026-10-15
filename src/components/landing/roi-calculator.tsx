"use client";

/**
 * ROI calculator. Pure arithmetic on the visitor's own inputs, no invented
 * industry averages: the night-chat share (40%) is the only given, and it is
 * labelled as such.
 */

import { useMemo, useState } from "react";
import { TrendingDown } from "lucide-react";
import { Card, cn, rupiah } from "@/components/ui";

function Slider({
  id,
  label,
  display,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-semibold text-ink-600">
          {label}
        </label>
        <span className="font-mono text-sm font-bold tabular-nums text-ink">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-ink-900
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-ink
          [&::-webkit-slider-thumb]:shadow-raised"
      />
    </div>
  );
}

export function RoiCalculator() {
  const [chats, setChats] = useState(40);
  const [margin, setMargin] = useState(50000);
  const [closeRate, setCloseRate] = useState(20);

  const { lostOrders, lostRevenue, roi } = useMemo(() => {
    // Night-time share of chats (20.00-02.00) is 40%.
    const nightChats = chats * 0.4 * 30;
    const lost = nightChats * (closeRate / 100);
    const revenue = lost * margin;
    return { lostOrders: lost, lostRevenue: revenue, roi: revenue > 0 ? revenue / 199000 : 0 };
  }, [chats, margin, closeRate]);

  const healthy = roi >= 1;

  return (
    <Card className="overflow-hidden">
      <div className="space-y-5 p-5 sm:p-6">
        <Slider
          id="roi-chats"
          label="Chat masuk per hari"
          display={String(chats)}
          value={chats}
          min={5}
          max={300}
          step={5}
          onChange={setChats}
        />
        <Slider
          id="roi-margin"
          label="Margin per produk"
          display={`Rp ${rupiah(margin)}`}
          value={margin}
          min={5000}
          max={300000}
          step={5000}
          onChange={setMargin}
        />
        <Slider
          id="roi-close"
          label="Peluang closing"
          display={`${closeRate}%`}
          value={closeRate}
          min={5}
          max={60}
          step={1}
          onChange={setCloseRate}
        />
      </div>

      <div className="border-t border-ink-800 bg-ink-900 p-5 text-white sm:p-6">
        <div className="flex items-center gap-2 text-ink-300">
          <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
          <p className="eyebrow text-ink-300">Estimasi omset hilang per bulan</p>
        </div>
        <p className="mt-2 font-mono text-3xl font-bold tracking-tight tabular-nums sm:text-4xl text-white">
          Rp {rupiah(lostRevenue)}
        </p>
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-2xs uppercase tracking-wide text-ink-300">Pesanan tak tertangani</p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">{rupiah(lostOrders)}</p>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wide text-ink-300">
              ROI pada biaya Rp 199.000 / bulan
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-sm font-semibold tabular-nums",
                healthy ? "text-signal" : "text-warn"
              )}
            >
              {roi.toFixed(1)}x
            </p>
          </div>
        </div>
        <p className="mt-3 text-2xs leading-relaxed text-ink-300">
          Dihitung dari input Anda sendiri memakai asumsi 40% chat masuk terjadi pukul 20.00 sampai
          02.00. Bukan rata-rata industri.
        </p>
      </div>
    </Card>
  );
}
