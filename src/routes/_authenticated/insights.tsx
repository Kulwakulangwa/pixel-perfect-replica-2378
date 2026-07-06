import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
export const Route = createFileRoute("/_authenticated/insights")({
  ssr: false,
  component: () => (
    <AppShell>
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <PageHeader title="Insights" description="Coming soon." />
        <div className="card-elev p-8 text-center text-sm text-muted-foreground">
          Inatengenezwa.
        </div>
      </div>
    </AppShell>
  ),
});
