import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    console.log("🔐 _authenticated/index beforeLoad");

    // 1. Retry getting the session (in case it's not yet persisted)
    let session = null;
    let retries = 0;
    while (!session && retries < 5) {
      const { data } = await supabase.auth.getSession();
      session = data.session;
      if (!session) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }
    }

    if (!session) {
      console.warn("⚠️ No session after retries, redirecting to /auth");
      throw redirect({ to: "/auth", replace: true });
    }

    // 2. Get the staff role
    const { data: staff, error } = await supabase
      .from("staff")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !staff) {
      console.warn("⚠️ No staff record, redirecting to /pos");
      throw redirect({ to: "/pos", replace: true });
    }

    // 3. Redirect based on role
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
