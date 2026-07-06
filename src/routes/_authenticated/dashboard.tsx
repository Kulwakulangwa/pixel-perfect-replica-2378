import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";
import { AlertTriangle, TrendingUp, Package, Users, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: DashboardPage,
});

function DashboardPage() {
  // ... rest of your dashboard code stays exactly the same
  // (keep the existing StatCard, Card, CardHeader, EmptyRow functions)
}
