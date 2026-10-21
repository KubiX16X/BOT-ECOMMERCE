import { getConfig, getOlxLimits, MAX_SERIES } from "@revion/core";
import { AdminHeader } from "@/components/AdminHeader";
import { GeneratorForm } from "@/components/GeneratorForm";
import { requireAdmin } from "@/lib/auth";

export default async function GeneratorPage() {
  await requireAdmin();
  const config = getConfig();
  return (
    <>
      <AdminHeader title="Generator ofert" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <GeneratorForm
          limits={getOlxLimits()}
          maxSeries={MAX_SERIES}
          setup={{ claude: !!config.anthropicApiKey, gemini: !!config.geminiApiKey, phone: !!config.sellerPhone }}
        />
      </main>
    </>
  );
}
