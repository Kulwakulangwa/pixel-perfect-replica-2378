import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/pos")({
  ssr: false,
  component: () => (
    <AppShell>
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <PageHeader title="POS" description="Cashier till — under construction." />
        <div className="card-elev p-8 text-center text-sm text-muted-foreground">
          Ukurasa wa mauzo unaendelea kutengenezwa. Rudi hivi karibuni.
        </div>
      </div>
    </AppShell>
  ),
});
