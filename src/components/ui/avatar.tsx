import * as React from "react";
import { initials, cn } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
  size = "md",
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeStyles = {
    sm: "size-7 text-[11px]",
    md: "size-9 text-sm",
    lg: "size-12 text-base",
  };

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-muted font-semibold text-primary",
        sizeStyles[size],
        className
      )}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}
