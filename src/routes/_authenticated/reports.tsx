import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
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
import { Loader2, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports")({
  ssr: false,
  component: ReportsPage,
});

type ReportType = "daily" | "weekly" | "monthly" | "bestsellers" | "profit" | "expenses" | "netprofit";

type Sale = {
  id: string;
  created_at: string;
  total: number;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  selling_price: number;
  unit_cost: number;
  products: {
    id: string;
    name: string;
    buying_price: number;
  };
};

type Expense = {
  id: string;
  amount: number;
  category: string;
  expense_date: string;
};

const fetchSalesData = async (from: string, to: string) => {
  const { data, error } = await supabase
    .from("sales")
    .select("id, created_at, total")
    .gte("created_at", from)
    .lte("created_at", to)
    .eq("status", "completed")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Sale[];
};

const fetchSaleItems = async (saleIds: string[]) => {
  if (saleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sale_items")
    .select(`
      id,
      sale_id,
      product_id,
      quantity,
      selling_price,
      unit_cost,
      products ( id, name, buying_price )
    `)
    .in("sale_id", saleIds);
  if (error) throw error;
  return data as SaleItem[];
};

const fetchExpenses = async (from: string, to: string) => {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, category, expense_date")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: true });
  if (error) throw error;
  return data as Expense[];
};

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
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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

  useMemo(() => {
    const { from, to } = getDefaultDateRange(reportType);
    setFromDate(from);
    setToDate(to);
  }, [reportType]);

  const salesQuery = useQuery({
    queryKey: ["salesData", fromDate, toDate],
    queryFn: () => fetchSalesData(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
  });

  const saleItemsQuery = useQuery({
    queryKey: ["saleItems", salesQuery.data?.map(s => s.id)],
    queryFn: () => fetchSaleItems(salesQuery.data?.map(s => s.id) || []),
    enabled: !!salesQuery.data && salesQuery.data.length > 0,
  });

  const expensesQuery = useQuery({
    queryKey: ["expensesData", fromDate, toDate],
    queryFn: () => fetchExpenses(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
  });

  const isLoading = salesQuery.isLoading || saleItemsQuery.isLoading || expensesQuery.isLoading;
  const error = salesQuery.error || saleItemsQuery.error || expensesQuery.error;

  // Compute aggregated metrics
  const reportData = useMemo(() => {
    if (!salesQuery.data || !saleItemsQuery.data || !expensesQuery.data) return null;

    const sales = salesQuery.data;
    const items = saleItemsQuery.data;
    const expenses = expensesQuery.data;

    // Total revenue
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

    // Total COGS (using unit_cost from sale_items)
    const totalCOGS = items.reduce((sum, item) => sum + (item.unit_cost || 0) * item.quantity, 0);

    // Gross profit
    const grossProfit = totalRevenue - totalCOGS;

    // Total expenses
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Net profit
    const netProfit = grossProfit - totalExpenses;

    // Group sales by period for daily/weekly/monthly
    const groupSales = (groupFn: (date: Date) => string) => {
      const groups: { [key: string]: { revenue: number; cogs: number } } = {};
      sales.forEach(sale => {
        const key = groupFn(new Date(sale.created_at));
        if (!groups[key]) groups[key] = { revenue: 0, cogs: 0 };
        groups[key].revenue += sale.total;
      });
      // Also add COGS per sale – but we need to map sale items to sale_id
      // We can compute per day by iterating items, but easier: we already have total revenue per day, and COGS per day can be derived by splitting items.
      // However, to keep it simple, we'll just show revenue per day, and the total metrics are already computed.
      // For detailed daily breakdown, we'd need to map items to sale dates.
      // We'll use a simpler approach: only show total revenue per day (no COGS per day) to keep it clear.
      return Object.entries(groups)
        .map(([label, { revenue }]) => ({ label, revenue }))
        .sort((a, b) => a.label.localeCompare(b.label));
    };

    let salesReport: { label: string; revenue: number }[] = [];
    let periodLabel = "";
    switch (reportType) {
      case "daily":
        periodLabel = "Tarehe";
        salesReport = groupSales(d => format(d, "yyyy-MM-dd"));
        break;
      case "weekly":
        periodLabel = "Wiki";
        salesReport = groupSales(d => `Wiki ${format(d, "w, yyyy")}`);
        break;
      case "monthly":
        periodLabel = "Mwezi";
        salesReport = groupSales(d => format(d, "MMM yyyy"));
        break;
      default:
        break;
    }

    // Best sellers
    const bestSellers = () => {
      const productSales: { [productId: string]: { name: string; quantity: number; revenue: number } } = {};
      items.forEach(item => {
        const p = item.products;
        if (!p) return;
        if (!productSales[p.id]) {
          productSales[p.id] = { name: p.name, quantity: 0, revenue: 0 };
        }
        productSales[p.id].quantity += item.quantity;
        productSales[p.id].revenue += item.quantity * item.selling_price;
      });
      return Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
    };

    // Expenses breakdown
    const expensesBreakdown = () => {
      const byCategory: { [key: string]: number } = {};
      expenses.forEach(e => {
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      });
      return { total: totalExpenses, byCategory };
    };

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalExpenses,
      netProfit,
      salesReport,
      periodLabel,
      bestSellers: bestSellers(),
      expenses: expensesBreakdown(),
    };
  }, [salesQuery.data, saleItemsQuery.data, expensesQuery.data, reportType]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("sw-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(value);

  const renderReport = () => {
    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (error) return <div className="text-red-500">Imeshindwa kupakia ripoti. Jaribu tena.</div>;
    if (!reportData) return <div className="text-muted-foreground">Hakuna data kwa kipindi hiki.</div>;

    switch (reportType) {
      case "daily":
      case "weekly":
      case "monthly":
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Jumla ya Mauzo: {formatCurrency(reportData.totalRevenue)}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{reportData.periodLabel}</TableHead>
                  <TableHead className="text-right">Jumla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.salesReport.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case "bestsellers":
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">Bidhaa Zinazouza Sana</div>
            {reportData.bestSellers.length === 0 ? (
              <p className="text-muted-foreground">Hakuna mauzo katika kipindi hiki.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bidhaa</TableHead>
                    <TableHead className="text-right">Idadi</TableHead>
                    <TableHead className="text-right">Mapato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.bestSellers.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        );

      case "profit":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Jumla ya Mauzo</div>
                <div className="text-2xl font-bold">{formatCurrency(reportData.totalRevenue)}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Gharama ya Bidhaa Zilizouzwa</div>
                <div className="text-2xl font-bold">{formatCurrency(reportData.totalCOGS)}</div>
              </div>
              <div className="p-4 border rounded-lg bg-green-50">
                <div className="text-sm text-muted-foreground">Faida ya Jumla (Gross Profit)</div>
                <div className="text-2xl font-bold text-green-700">{formatCurrency(reportData.grossProfit)}</div>
              </div>
              <div className="p-4 border rounded-lg bg-blue-50">
                <div className="text-sm text-muted-foreground">Gharama Zote</div>
                <div className="text-2xl font-bold text-blue-700">{formatCurrency(reportData.totalExpenses)}</div>
              </div>
            </div>
            <div className="p-4 border rounded-lg bg-yellow-50">
              <div className="text-sm text-muted-foreground">Faida Halisi (Net Profit)</div>
              <div className="text-2xl font-bold text-yellow-700">{formatCurrency(reportData.netProfit)}</div>
            </div>
          </div>
        );

      case "expenses":
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Jumla ya Gharama: {formatCurrency(reportData.expenses.total)}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aina</TableHead>
                  <TableHead className="text-right">Kiasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(reportData.expenses.byCategory).map(([category, amount]) => (
                  <TableRow key={category}>
                    <TableCell className="capitalize">{category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case "netprofit":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Mauzo</div>
                <div className="text-xl font-bold">{formatCurrency(reportData.totalRevenue)}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">COGS</div>
                <div className="text-xl font-bold">{formatCurrency(reportData.totalCOGS)}</div>
              </div>
              <div className="p-4 border rounded-lg bg-green-50">
                <div className="text-sm text-muted-foreground">Faida ya Jumla</div>
                <div className="text-xl font-bold text-green-700">{formatCurrency(reportData.grossProfit)}</div>
              </div>
              <div className="p-4 border rounded-lg bg-blue-50">
                <div className="text-sm text-muted-foreground">Gharama</div>
                <div className="text-xl font-bold text-blue-700">{formatCurrency(reportData.totalExpenses)}</div>
              </div>
              <div className="p-4 border rounded-lg bg-yellow-50">
                <div className="text-sm text-muted-foreground">Faida Halisi</div>
                <div className="text-xl font-bold text-yellow-700">{formatCurrency(reportData.netProfit)}</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Faida Halisi = Mauzo – Gharama ya Bidhaa – Gharama zingine
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AppShell>
      <PageHeader title="Ripoti" description="Changanua mauzo, faida, gharama na faida halisi" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <Label htmlFor="reportType">Aina ya Ripoti</Label>
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Mauzo ya Siku</SelectItem>
              <SelectItem value="weekly">Mauzo ya Wiki</SelectItem>
              <SelectItem value="monthly">Mauzo ya Mwezi</SelectItem>
              <SelectItem value="bestsellers">Bidhaa Zinazouza Sana</SelectItem>
              <SelectItem value="profit">Faida (Gross & Net)</SelectItem>
              <SelectItem value="expenses">Gharama</SelectItem>
              <SelectItem value="netprofit">Faida Halisi (Net Profit)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="fromDate">Kuanzia</Label>
          <Input
            id="fromDate"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="toDate">Mpaka</Label>
          <Input
            id="toDate"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
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

      <div className="border rounded-lg p-4">
        {renderReport()}
      </div>
    </AppShell>
  );
}
