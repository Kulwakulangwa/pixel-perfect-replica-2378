import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfToday, endOfToday } from "date-fns";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, TrendingUp, ShoppingBag, CreditCard, Wallet, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/today")({
  ssr: false,
  component: TodayPage,
});

type TodaySale = {
  id: string;
  receipt_number: string;
  total: number;
  payment_method: string;
  sale_type: string;
  customer_id: string | null;
  cashier_id: string;
  created_at: string;
  customers: {
    name: string | null;
  } | null;
  cashier_name?: string;
};

type TodaySummary = {
  total_revenue: number;
  total_sales: number;
  total_cash: number;
  total_credit: number;
  average_sale: number;
};

function TodayPage() {
  const [dateDescription, setDateDescription] = useState("");
  useEffect(() => {
    setDateDescription(format(new Date(), "EEEE, dd MMMM yyyy"));
  }, []);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["currentStaff"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("staff")
        .select("id, role")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch today's sales
  const { data, isLoading, error } = useQuery({
    queryKey: ["todaySales"],
    queryFn: async () => {
      if (!staff) return null;
      const today = new Date();
      const from = startOfToday().toISOString();
      const to = endOfToday().toISOString();

      // First: fetch all sales with cashier_id
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(`
          id,
          receipt_number,
          total,
          payment_method,
          sale_type,
          customer_id,
          cashier_id,
          created_at,
          customers ( name )
        `)
        .gte("created_at", from)
        .lte("created_at", to)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (salesError) throw salesError;

      // Second: fetch cashier names for all unique cashier_ids
      const cashierIds = [...new Set(sales?.map(s => s.cashier_id).filter(Boolean))];
      let cashierNames: Record<string, string> = {};
      if (cashierIds.length > 0) {
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("id, full_name")
          .in("id", cashierIds);
        if (!staffError) {
          cashierNames = staffData.reduce((acc, cur) => {
            acc[cur.id] = cur.full_name || cur.id;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Attach cashier name to each sale
      const enrichedSales = sales?.map(sale => ({
        ...sale,
        cashier_name: cashierNames[sale.cashier_id] || sale.cashier_id.slice(0, 8),
      })) || [];

      const totalRevenue = enrichedSales.reduce((sum, s) => sum + s.total, 0) || 0;
      const totalSales = enrichedSales.length || 0;
      const totalCash = enrichedSales
        .filter(s => s.payment_method === "cash")
        .reduce((sum, s) => sum + s.total, 0) || 0;
      const totalCredit = enrichedSales
        .filter(s => s.payment_method === "credit")
        .reduce((sum, s) => sum + s.total, 0) || 0;
      const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;

      return {
        sales: enrichedSales,
        summary: {
          total_revenue: totalRevenue,
          total_sales: totalSales,
          total_cash: totalCash,
          total_credit: totalCredit,
          average_sale: averageSale,
        },
      };
    },
    enabled: !!staff,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0,
    }).format(value);

  const formatTime = (iso: string) => format(new Date(iso), "HH:mm");

  // --- Stat card component (mirrors dashboard) ---
  const STAT_STYLES = {
    dark: {
      card: "bg-[#16294A] dark:bg-[#0a1628] text-white dark:text-slate-200 border-transparent",
      label: "text-white/70 dark:text-slate-300",
      iconWrap: "bg-white/10 text-white dark:bg-slate-700/50 dark:text-slate-200",
    },
    mint: {
      card: "bg-white dark:bg-[#121212] border-border dark:border-border/30",
      label: "text-muted-foreground dark:text-muted-foreground/80",
      iconWrap: "bg-[#E4F7EC] text-[#2FAE60] dark:bg-[#0a2a1a] dark:text-[#34d399]",
    },
    amber: {
      card: "bg-white dark:bg-[#121212] border-border dark:border-border/30",
      label: "text-muted-foreground dark:text-muted-foreground/80",
      iconWrap: "bg-[#FFF1DE] text-[#F5A623] dark:bg-[#3a2a10] dark:text-[#fbbf24]",
    },
    rose: {
      card: "bg-white dark:bg-[#121212] border-border dark:border-border/30",
      label: "text-muted-foreground dark:text-muted-foreground/80",
      iconWrap: "bg-[#FDE7E5] text-[#E4574A] dark:bg-[#3a1a1a] dark:text-[#f87171]",
    },
  };

  function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    variant = "mint",
  }: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ComponentType<{ className?: string }>;
    variant?: keyof typeof STAT_STYLES;
  }) {
    const v = STAT_STYLES[variant];
    return (
      <div className={`rounded-2xl border p-4 lg:p-5 shadow-sm ${v.card}`}>
        <div className="flex items-start justify-between">
          <div className={`text-xs font-medium uppercase tracking-wide ${v.label}`}>{label}</div>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${v.iconWrap}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 text-2xl lg:text-3xl font-bold tracking-tight">{value}</div>
        {sub && <div className={`text-xs mt-1 ${v.label}`}>{sub}</div>}
      </div>
    );
  }

  // --- Loading & error states ---
  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="text-red-500 p-4">Imeshindwa kupakia mauzo ya leo. Jaribu tena.</div>
      </AppShell>
    );
  }

  const { sales, summary } = data;

  return (
    <AppShell>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <PageHeader title="Mauzo ya Leo" description={dateDescription} />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Jumla ya Mauzo"
            value={formatCurrency(summary.total_revenue)}
            sub={`${summary.total_sales} mauzo`}
            icon={TrendingUp}
            variant="dark"
          />
          <StatCard
            label="Fedha"
            value={formatCurrency(summary.total_cash)}
            icon={Wallet}
            variant="mint"
          />
          <StatCard
            label="Mkopo"
            value={formatCurrency(summary.total_credit)}
            icon={CreditCard}
            variant="amber"
          />
          <StatCard
            label="Wastani wa Mauzo"
            value={formatCurrency(summary.average_sale)}
            icon={ShoppingBag}
            variant="rose"
          />
        </div>

        {/* Sales Table */}
        <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risiti</TableHead>
                <TableHead>Mteja</TableHead>
                <TableHead className="text-right">Jumla</TableHead>
                <TableHead>Malipo</TableHead>
                <TableHead>Saa</TableHead>
                <TableHead>Aliyeuza</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Hakuna mauzo leo.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.receipt_number}</TableCell>
                    <TableCell>{sale.customers?.name || "Mteja wa Oda"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(sale.total)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          sale.payment_method === "cash"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {sale.payment_method === "cash" ? "Fedha" : "Mkopo"}
                      </span>
                    </TableCell>
                    <TableCell>{formatTime(sale.created_at)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sale.cashier_name}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
