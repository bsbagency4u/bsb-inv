import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const pages = React.useMemo(() => {
    const visible = new Set<number>([1, totalPages, page - 1, page, page + 1]);
    return Array.from(visible)
      .filter((p) => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1 py-2",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, index) => {
          const prev = pages[index - 1];
          const showGap = prev && p - prev > 1;
          return (
            <React.Fragment key={p}>
              {showGap ? (
                <span className="px-1 text-xs text-muted-foreground">…</span>
              ) : null}
              <Button
                variant={p === page ? "primary" : "outline"}
                size="sm"
                onClick={() => onPageChange(p)}
                className="w-8 px-0"
              >
                {p}
              </Button>
            </React.Fragment>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
