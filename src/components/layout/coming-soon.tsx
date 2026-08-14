import { Hammer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "./page-header";

/**
 * Renders a clearly-marked placeholder for modules that belong to later
 * phases. Unfinished modules must never pretend to work.
 */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        description="This module is part of a later phase."
      />
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Hammer className="size-7" />
        </div>
        <Badge variant="secondary">Planned for Phase {phase}</Badge>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
