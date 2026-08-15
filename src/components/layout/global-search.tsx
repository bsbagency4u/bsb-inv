"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { getClientServices } from "@/services";
import type { SearchResult } from "@/types/domain";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getErrorMessage } from "@/lib/utils";

const ENTITY_LABELS: Record<string, string> = {
  product: "Products",
  customer: "Customers",
  supplier: "Suppliers",
  invoice: "Invoices",
  purchase: "Purchases",
  stock: "Stock",
};

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const { business } = useSession();
  const debouncedQuery = useDebouncedValue(query, 200);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timeout);
  }, [open]);

  React.useEffect(() => {
    let active = true;
    const run = async () => {
      if (!debouncedQuery) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = business
          ? await getClientServices().search.search(business.id, debouncedQuery)
          : [];
        if (active) setResults(data);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [debouncedQuery, business]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const result of results) {
      const key = ENTITY_LABELS[result.entityType] ?? "Other";
      const list = map.get(key) ?? [];
      list.push(result);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [results]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:border-input/80 hover:bg-accent"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search anything…</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-overlay">
                <div className="flex items-center gap-2 border-b border-border px-4">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search products, customers, invoices, suppliers…"
                    className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                    aria-label="Global search"
                  />
                  {loading ? <Spinner className="size-4 text-muted-foreground" /> : null}
                </div>

                <div className="max-h-[50vh] overflow-y-auto p-2">
                  {error ? (
                    <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>
                  ) : !query ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Type to search across your business.
                    </p>
                  ) : grouped.length === 0 && !loading ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No results for “{query}”.
                    </p>
                  ) : (
                    grouped.map(([label, items]) => (
                      <div key={label} className="mb-1">
                        <p className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                        {items.map((item) => (
                          <button
                            key={`${item.entityType}-${item.id}`}
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              router.push(item.href ?? "/dashboard");
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {item.title}
                              </p>
                              {item.subtitle ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.subtitle}
                                </p>
                              ) : null}
                            </div>
                            {item.meta ? (
                              <Badge variant="secondary" className="shrink-0">
                                {item.meta}
                              </Badge>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
