import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw redirect({ to: "/auth", replace: true });
      }
      const { data: staff, error } = await supabase
        .from("staff")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (error || !staff) {
        throw redirect({ to: "/pos", replace: true });
      }
      if (staff.role === "owner") {
        throw redirect({ to: "/dashboard", replace: true });
      } else {
        throw redirect({ to: "/pos", replace: true });
      }
    } catch (err) {
      if (isRedirect(err)) throw err;
      throw redirect({ to: "/auth", replace: true });
    }
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
});
