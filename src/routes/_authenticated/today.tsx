import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
const Stub = ({ title }: { title: string }) => (
  <AppShell>
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <PageHeader title={title} description="Coming soon." />
      <div className="card-elev p-8 text-center text-sm text-muted-foreground">Inatengenezwa.</div>
    </div>
  </AppShell>
);
export const Route = createFileRoute("/_authenticated/today")({ ssr: false, component: () => <Stub title="Mauzo ya leo" /> });
