"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/utils";
import type { DashboardSeriesPoint } from "@/lib/dashboard";

const SALES_COLOR = "#4f46e5";
const PURCHASE_COLOR = "#8b5cf6";

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 16, right: 12, bottom: 30, left: 60 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

function compactCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      notation: "compact",
      maximumFractionDigits: 1,
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const scaled = value / base;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * base;
}

export function SalesPurchaseChart({
  points,
  currency,
}: {
  points: DashboardSeriesPoint[];
  currency: string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  const maxValue = points.reduce(
    (max, point) => Math.max(max, point.sales, point.purchases),
    0
  );
  const axisMax = niceCeil(maxValue);
  const hasData = axisMax > 0;

  const plotBottom = PADDING.top + PLOT_HEIGHT;
  const groupWidth = points.length > 0 ? PLOT_WIDTH / points.length : PLOT_WIDTH;
  const barWidth = Math.max(3, Math.min(16, groupWidth * 0.3));

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const hoveredPoint = hovered != null ? points[hovered] : null;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: SALES_COLOR }} />
            Sales
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: PURCHASE_COLOR }} />
            Purchases
          </span>
        </div>
        {hoveredPoint ? (
          <p className="text-xs tabular-nums text-foreground">
            <span className="font-medium">{hoveredPoint.label}</span>
            <span className="text-muted-foreground">
              {" · "}
              Sales {formatCurrency(hoveredPoint.sales, currency)} · Purchases{" "}
              {formatCurrency(hoveredPoint.purchases, currency)}
            </span>
          </p>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-64 w-full"
        role="img"
        aria-label="Grouped bar chart comparing sales and purchases over the selected period"
        preserveAspectRatio="xMidYMid meet"
      >
        {gridLines.map((ratio) => {
          const y = PADDING.top + PLOT_HEIGHT * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {compactCurrency(axisMax * ratio, currency)}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
          const groupX = PADDING.left + index * groupWidth;
          const centerX = groupX + groupWidth / 2;
          const salesHeight = hasData ? (point.sales / axisMax) * PLOT_HEIGHT : 0;
          const purchaseHeight = hasData ? (point.purchases / axisMax) * PLOT_HEIGHT : 0;
          const salesX = centerX - barWidth - 1;
          const purchaseX = centerX + 1;
          const showLabel = index % labelStep === 0 || index === points.length - 1;
          const isHovered = hovered === index;

          return (
            <g key={point.date}>
              {isHovered ? (
                <rect
                  x={groupX}
                  y={PADDING.top}
                  width={groupWidth}
                  height={PLOT_HEIGHT}
                  fill="var(--color-muted)"
                  opacity={0.6}
                />
              ) : null}
              <rect
                x={salesX}
                y={plotBottom - salesHeight}
                width={barWidth}
                height={Math.max(salesHeight, point.sales > 0 ? 2 : 0)}
                rx={2}
                fill={SALES_COLOR}
              >
                <title>
                  {`${point.label} · Sales ${formatCurrency(point.sales, currency)}`}
                </title>
              </rect>
              <rect
                x={purchaseX}
                y={plotBottom - purchaseHeight}
                width={barWidth}
                height={Math.max(purchaseHeight, point.purchases > 0 ? 2 : 0)}
                rx={2}
                fill={PURCHASE_COLOR}
              >
                <title>
                  {`${point.label} · Purchases ${formatCurrency(point.purchases, currency)}`}
                </title>
              </rect>
              <rect
                x={groupX}
                y={PADDING.top}
                width={groupWidth}
                height={PLOT_HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              />
              {showLabel ? (
                <text
                  x={centerX}
                  y={HEIGHT - 10}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {!hasData ? (
          <text
            x={PADDING.left + PLOT_WIDTH / 2}
            y={PADDING.top + PLOT_HEIGHT / 2}
            textAnchor="middle"
            className="fill-muted-foreground text-xs"
          >
            No sales or purchases in this period
          </text>
        ) : null}
      </svg>
    </div>
  );
}
