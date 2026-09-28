"use client";

import type { PrintVariantSummary } from "@/lib/storefront";

type PrintVariantPickerProps = {
  variants: PrintVariantSummary[];
  value: string;
  onChange: (id: string) => void;
};

export function PrintVariantPicker({ variants, value, onChange }: PrintVariantPickerProps) {
  if (variants.length === 0) return null;
  return (
    <label className="print-variant-picker">
      <span>Print size</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Print size">
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.size} ({variant.widthMm} × {variant.heightMm} mm) — ${(variant.priceCents / 100).toFixed(2)}
          </option>
        ))}
      </select>
    </label>
  );
}
