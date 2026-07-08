import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth", replace: true });

    const { data: staff, error } = await supabase
      .from("staff")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !staff) throw redirect({ to: "/pos", replace: true });
    if (staff.role === "owner") throw redirect({ to: "/dashboard", replace: true });
    throw redirect({ to: "/pos", replace: true });
  },
  component: () => null, // never rendered
});
