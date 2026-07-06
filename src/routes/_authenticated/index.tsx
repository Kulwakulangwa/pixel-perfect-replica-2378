import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
// ... rest of imports

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  // Fetch current user and staff role
  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });
  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ["currentStaff"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("staff")
        .select("role")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Redirect cashiers to POS
  useEffect(() => {
    if (staff?.role === 'cashier') {
      navigate({ to: "/pos", replace: true });
    }
  }, [staff, navigate]);

  if (staffLoading || !staff) return <div>Loading...</div>;
  if (staff?.role === 'cashier') return null; // will redirect

  // For owners: show dashboard (the dashboard component)
  return <DashboardPage />;
}

// The DashboardPage component from your code
// ... put the entire dashboard component here
