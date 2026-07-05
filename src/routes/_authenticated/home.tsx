import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Dispatches to the correct home screen based on role.
export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: staff } = await supabase
      .from("staff")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (staff?.role === "owner") throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/pos" });
  },
  component: () => null,
});
