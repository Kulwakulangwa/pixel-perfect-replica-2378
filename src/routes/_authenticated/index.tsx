import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    console.log("🔐 _authenticated/index beforeLoad");

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.warn("⚠️ No session, redirecting to /auth");
      throw redirect({ to: "/auth", replace: true });
    }

    const { data: staff, error } = await supabase
      .from("staff")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !staff) {
      console.warn("⚠️ No staff record, redirecting to /pos");
      throw redirect({ to: "/pos", replace: true });
    }

    if (staff.role === "owner") {
      console.log("✅ Redirecting owner to /dashboard");
      throw redirect({ to: "/dashboard", replace: true });
    } else {
      console.log("✅ Redirecting cashier to /pos");
      throw redirect({ to: "/pos", replace: true });
    }
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
});
