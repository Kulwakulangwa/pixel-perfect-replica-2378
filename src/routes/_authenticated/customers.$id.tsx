import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
export const Route = createFileRoute("/_authenticated/customers/$id")({ ssr: false, component: () => (
  <AppShell requireOwner><div className="p-4 lg:p-8 max-w-3xl mx-auto"><PageHeader title="Mteja" description="Coming soon." /><div className="card-elev p-8 text-center text-sm text-muted-foreground">Inatengenezwa.</div></div></AppShell>
)});
