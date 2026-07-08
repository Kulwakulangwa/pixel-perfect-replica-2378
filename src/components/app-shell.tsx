import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">{children}</div>
    </div>
  );
}

export function PageHeader({ title }: { title: string }) {
  return <h1 className="text-2xl font-bold mb-4">{title}</h1>;
}
