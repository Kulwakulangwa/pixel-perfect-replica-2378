import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const redirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data: staff } = await supabase
        .from("staff")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!mounted) return;
      if (staff?.role === "owner") {
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/pos", replace: true });
      }
    };
    redirect().finally(() => {
      if (mounted) setChecking(false);
    });
    return () => { mounted = false; };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return null;
}
