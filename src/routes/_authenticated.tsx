import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"owner" | "cashier" | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) {
          // Redirect to auth if no session
          window.location.href = "/auth";
        }
        return;
      }
      const { data: staff, error } = await supabase
        .from("staff")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error || !staff) {
        // No staff record – treat as cashier (or redirect to POS)
        setUserRole("cashier");
      } else {
        setUserRole(staff.role as "owner" | "cashier");
      }
      setLoading(false);
    };
    checkSession();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // If no role (should not happen), redirect to auth
  if (!userRole) {
    return <div>Redirecting...</div>;
  }

  // Pass the role to the outlet via context? For simplicity, we'll let each route fetch it again.
  // But we can also use a context provider. To avoid extra code, we'll let AppShell fetch again.
  // However, we can also store the role in a global store, but for now, we'll just render the outlet.
  return <Outlet />;
}
