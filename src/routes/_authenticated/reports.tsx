import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Calendar, TrendingUp, ShoppingBag, Wallet, Receipt, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader as CardHeaderUI, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports")({
  ssr: false,
  component: () => (
    <AppShell requireOwner>
      <ReportsPage />
    </AppShell>
  ),
});

type ReportType = "daily" | "weekly" | "monthly" | "bestsellers" | "profit" | "expenses";

// --- Helper to get default date range ---
const getDefaultDateRange = (reportType: ReportType) => {
  const now = new Date();
  let from: Date, to: Date;
  switch (reportType) {
    case "daily":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
      break;
    case "weekly":
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case "monthly":
      from = startOfMonth(now);
      to = endOfMonth(now);
      break;
    default:
      from = subDays(now, 30);
      to = now;
  }
  return {
    from: format(from, "yyyy-MM-dd"),
    to: format(to, "yyyy-MM-dd"),
  };
};

function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [dateDescription, setDateDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default date range when report type changes
  useEffect(() => {
    const { from, to } = getDefaultDateRange(reportType);
    setFromDate(from);
    setToDate(to);
    setDateDescription(`${format(new Date(from), "dd/MM/yyyy")} - ${format(new Date(to), "dd/MM/yyyy")}`);
  }, [reportType]);

  // --- Queries ---
  // 1. Sales summary via RPC
  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ["report-summary", fromDate, toDate],
    queryFn: async () => {
      if (!fromDate || !toDate) return null;
      const { data, error } = await supabase.rpc("report_sales_summary", {
        _from: fromDate,
        _to: toDate,
      });
      if (error) {
        console.error("RPC error:", error);
        throw error;
      }
      return data as Array<{ day: string; sales_count: number; revenue: number; cost: number; profit: number; discount_total: number }>;
    },
    enabled: !!fromDate && !!toDate,
  });

  // 2. Best sellers
  const { data: bestSellersData, isLoading: bestSellersLoading, error: bestSellersError } = useQuery({
    queryKey: ["best-sellers", fromDate, toDate],
    queryFn: async () => {
      if (!fromDate || !toDate) return [];
      const { data, error } = await supabase
        .from("v_best_sellers")
        .select("product_id, product_name, units_sold, revenue")
        .order("revenue", { ascending: false })
        .limit(10);
      if (error) {
        console.error("Best sellers error:", error);
        throw error;
      }
      return data;
    },
    enabled: !!fromDate && !!toDate,
  });

  // 3. Expenses for the period
  const { data: expensesData, isLoading: expensesLoading, error: expensesError } = useQuery({
    queryKey: ["expenses-data", fromDate, toDate],
    queryFn: async () => {
      if (!fromDate || !toDate) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category, expense_date")
        .gte("expense_date", fromDate)
        .lte("expense_date", toDate)
        .order("expense_date", { ascending: true });
      if (error) {
        console.error("Expenses error:", error);
        throw error;
      }
      return data;
    },
    enabled: !!fromDate && !!toDate,
  });

  // Combine loading states
  const isLoading = summaryLoading || bestSellersLoading || expensesLoading;
  const hasError = summaryError || bestSellersError || expensesError;

  // --- Compute derived data ---
  const reportData = useMemo(() => {
    if (!summaryData || !bestSellersData || !expensesData) return null;

    // Group sales by day/week/month
    const groupSales = (groupFn: (date: Date) => string) => {
      const groups: Record<string, { revenue: number; profit: number; count: number }> = {};
      summaryData.forEach((row) => {
        const d = new Date(row.day);
        const key = groupFn(d);
        if (!groups[key]) groups[key] = { revenue: 0, profit: 0, count: 0 };
        groups[key].revenue += Number(row.revenue);
        groups[key].profit += Number(row.profit);
        groups[key].count += Number(row.sales_count);
      });
      return Object.entries(groups).map(([label, data]) => ({
        label,
        revenue: data.revenue,
        profit: data.profit,
        count: data.count,
      }));
    };

    let salesReport: { label: string; revenue: number; profit: number; count: number }[] = [];
    let periodLabel = "";
    switch (reportType) {
      case "daily":
        periodLabel = "Siku";
        salesReport = groupSales((d) => format(d, "yyyy-MM-dd"));
        break;
      case "weekly":
        periodLabel = "Wiki";
        salesReport = groupSales((d) => `Wiki ${format(d, "w, yyyy")}`);
        break;
      case "monthly":
        periodLabel = "Mwezi";
        salesReport = groupSales((d) => format(d, "MMM yyyy"));
        break;
      default:
        break;
    }

    // Total revenue for the period
    const totalRevenue = salesReport.reduce((s, r) => s + r.revenue, 0);
    const totalProfit = salesReport.reduce((s, r) => s + r.profit, 0);
    const totalSalesCount = salesReport.reduce((s, r) => s + r.count, 0);

    // Best sellers
    const bestSellers = bestSellersData.map((item) => ({
      ...item,
      revenue: Number(item.revenue),
    }));

    // Expenses
    const totalExpenses = expensesData.reduce((sum, e) => sum + Number(e.amount), 0);
    const expensesByCategory: Record<string, number> = {};
    expensesData.forEach((e) => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
    });

    return {
      salesReport,
      periodLabel,
      totalRevenue,
      totalProfit,
      totalSalesCount,
      bestSellers,
      expenses: {
        total: totalExpenses,
        byCategory: expensesByCategory,
      },
    };
  }, [summaryData, bestSellersData, expensesData, reportType]);

  // --- Render helpers ---
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0,
    }).format(value);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="text-red-500 p-4 flex flex-col items-center gap-2">
          <AlertCircle className="h-8 w-8" />
          <p>Imeshindwa kupakia ripoti. Jaribu tena.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Jaribu tena
          </Button>
        </div>
      );
    }

    if (!reportData) {
      return <div className="text-center py-8 text-muted-foreground">Hakuna data kwa kipindi hiki.</div>;
    }

    switch (reportType) {
      case "daily":
      case "weekly":
      case "monthly":
        return renderSalesTable(reportData);
      case "bestsellers":
        return renderBestSellers(reportData);
      case "profit":
        return renderProfit(reportData);
      case "expenses":
        return renderExpenses(reportData);
      default:
        return null;
    }
  };

  const renderSalesTable = (data: any) => {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Jumla ya Mauzo"
            value={formatCurrency(data.totalRevenue)}
            icon={TrendingUp}
            variant="mint"
          />
          <StatCard
            label="Faida Jumla"
            value={formatCurrency(data.totalProfit)}
            icon={Wallet}
            variant="amber"
          />
          <StatCard
            label="Idadi ya Mauzo"
            value={String(data.totalSalesCount)}
            icon={Receipt}
            variant="rose"
          />
        </div>
        <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{data.periodLabel}</TableHead>
                <TableHead className="text-right">Mauzo</TableHead>
                <TableHead className="text-right">Faida</TableHead>
                <TableHead className="text-right">Idadi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.salesReport.map((row: any) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(row.profit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderBestSellers = (data: any) => {
    return (
      <div>
        <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Bidhaa</TableHead>
                <TableHead className="text-right">Idadi</TableHead>
                <TableHead className="text-right">Mapato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bestSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Hakuna mauzo katika kipindi hiki.
                  </TableCell>
                </TableRow>
              ) : (
                data.bestSellers.map((item: any, i: number) => (
                  <TableRow key={item.product_id}>
                    <TableCell>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16294A] dark:bg-[#2a4a7a] text-[11px] font-semibold text-white">
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.units_sold}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(item.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderProfit = (data: any) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Jumla ya Mauzo"
          value={formatCurrency(data.totalRevenue)}
          icon={TrendingUp}
          variant="mint"
        />
        <StatCard
          label="Faida Jumla"
          value={formatCurrency(data.totalProfit)}
          icon={Wallet}
          variant="amber"
        />
        <StatCard
          label="Gharama Jumla"
          value={formatCurrency(data.expenses.total)}
          icon={AlertCircle}
          variant="rose"
        />
        <div className="col-span-full">
          <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Faida inahesabiwa kwa kutoa gharama za bidhaa (buying price) kutoka bei ya kuuza. Gharama za uendeshaji zimeonyeshwa hapo juu.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderExpenses = (data: any) => {
    const categories = Object.entries(data.expenses.byCategory);
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Jumla ya Gharama"
            value={formatCurrency(data.expenses.total)}
            icon={Wallet}
            variant="rose"
          />
          <StatCard
            label="Aina za Gharama"
            value={String(categories.length)}
            icon={Receipt}
            variant="mint"
          />
        </div>
        <div className="rounded-2xl border border-border bg-white dark:bg-[#121212] overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aina</TableHead>
                <TableHead className="text-right">Kiasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    Hakuna gharama katika kipindi hiki.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map(([category, amount]) => (
                  <TableRow key={category}>
                    <TableCell className="capitalize">{category.replace("_", " ")}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // --- StatCard component (mirrors dashboard) ---
  const STAT_STYLES = {
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
    icon: Icon,
    variant = "mint",
  }: {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    variant?: keyof typeof STAT_STYLES;
  }) {
    const v = STAT_STYLES[variant];
    return (
      <div className={`rounded-2xl border p-4 shadow-sm ${v.card}`}>
        <div className="flex items-start justify-between">
          <div className={`text-xs font-medium uppercase tracking-wide ${v.label}`}>{label}</div>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${v.iconWrap}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 text-2xl lg:text-3xl font-bold tracking-tight">{value}</div>
      </div>
    );
  }

  // --- Main render ---
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Ripoti"
        description="Changanua mauzo, faida na gharama zako"
      />

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-white dark:bg-[#121212] rounded-2xl border border-border p-4 shadow-sm">
        <div>
          <Label htmlFor="reportType" className="text-sm font-medium">Aina ya Ripoti</Label>
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Mauzo ya Siku</SelectItem>
              <SelectItem value="weekly">Mauzo ya Wiki</SelectItem>
              <SelectItem value="monthly">Mauzo ya Mwezi</SelectItem>
              <SelectItem value="bestsellers">Bidhaa Zinazouza Sana</SelectItem>
              <SelectItem value="profit">Faida</SelectItem>
              <SelectItem value="expenses">Gharama</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="fromDate" className="text-sm font-medium">Kuanzia</Label>
          <Input
            id="fromDate"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="toDate" className="text-sm font-medium">Mpaka</Label>
          <Input
            id="toDate"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const { from, to } = getDefaultDateRange(reportType);
              setFromDate(from);
              setToDate(to);
            }}
          >
            <Calendar className="mr-2 h-4 w-4" /> Sakinisha Tarehe
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {renderContent()}
      </div>
    </div>
  );
}
