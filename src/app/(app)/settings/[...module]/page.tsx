import { notFound } from "next/navigation";
import { SETTINGS_PLACEHOLDERS } from "@/config/modules";
import { ComingSoon } from "@/components/layout/coming-soon";

export default async function SettingsPlaceholderPage({
  params,
}: {
  params: Promise<{ module: string[] }>;
}) {
  const { module } = await params;
  const path = `/${["settings", ...module].join("/")}`;
  const config = SETTINGS_PLACEHOLDERS[path];
  if (!config) notFound();

  return (
    <ComingSoon title={config.title} description={config.description} phase={config.phase} />
  );
}
