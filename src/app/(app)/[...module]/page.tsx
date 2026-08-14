import { notFound } from "next/navigation";
import { MODULE_PLACEHOLDERS } from "@/config/modules";
import { ComingSoon } from "@/components/layout/coming-soon";

/**
 * Catch-all for future modules (Phase 2–5). Static pages win over this route,
 * so adding a real page automatically replaces the placeholder. Unknown paths
 * return 404 — nothing fake is shown.
 */
export default async function ModulePlaceholderPage({
  params,
}: {
  params: Promise<{ module: string[] }>;
}) {
  const { module } = await params;
  const path = `/${module.join("/")}`;
  const config = MODULE_PLACEHOLDERS[path];
  if (!config) notFound();

  return (
    <ComingSoon title={config.title} description={config.description} phase={config.phase} />
  );
}
