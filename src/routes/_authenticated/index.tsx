import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw redirect({ to: "/auth" });
      }
      const { data: staff, error } = await supabase
        .from("staff")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (error || !staff) {
        throw redirect({ to: "/pos" });
      }
      if (staff.role === "owner") {
        throw redirect({ to: "/dashboard" });
      } else {
        throw redirect({ to: "/pos" });
      }
    } catch (err) {
      // If anything fails, redirect to auth
      throw redirect({ to: "/auth" });
    }
  },
  // Fallback component (should never render due to redirect)
  component: () => {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  },
});
