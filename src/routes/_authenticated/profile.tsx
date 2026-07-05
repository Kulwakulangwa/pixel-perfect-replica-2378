import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useStaff, signOut } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/profile")({ ssr: false, component: () => {
  const { staff } = useStaff();
  return (
    <AppShell>
      <div className="p-4 lg:p-8 max-w-md mx-auto">
        <PageHeader title="Profile" />
        <div className="card-elev p-5 space-y-3">
          <div><div className="text-xs text-muted-foreground">Jina</div><div className="font-medium">{staff?.full_name}</div></div>
          <div><div className="text-xs text-muted-foreground">Barua pepe</div><div className="font-medium">{staff?.email}</div></div>
          <div><div className="text-xs text-muted-foreground">Nafasi</div><div className="font-medium capitalize">{staff?.role}</div></div>
          <Button variant="destructive" className="w-full mt-2" onClick={() => signOut()}>Toka</Button>
        </div>
      </div>
    </AppShell>
  );
}});
