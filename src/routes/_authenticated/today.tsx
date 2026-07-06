import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfToday, endOfToday } from "date-fns";
import { AppShell, PageHeader } from "@/components/app-shell";
// ... rest of your imports

export const Route = createFileRoute("/_authenticated/today")({
  ssr: false,
  component: TodayPage,
});

function TodayPage() {
  // ... your existing TodayPage code (no requireOwner)
}
