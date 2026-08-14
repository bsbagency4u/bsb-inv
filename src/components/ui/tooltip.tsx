"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SIDE_CLASSES: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-[90] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-popover",
            SIDE_CLASSES[side]
          )}
        >
          {content}
        </div>
      ) : null}
    </div>
  );
}
