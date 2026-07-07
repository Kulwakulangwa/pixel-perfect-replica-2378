import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
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
      if (isRedirect(err)) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => null,
});
